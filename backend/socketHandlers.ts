import { Server, Socket } from "socket.io";
import { RoomData } from './types';

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let roomManager: any;
let matchmaking: any;

// Initialize the module with required dependencies
export const initSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  roomManagerRef: any,
  matchmakingRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  roomManager = roomManagerRef;
  matchmaking = matchmakingRef;
  
  console.log('[SocketHandlers] Module initialized');
  return setupSocketHandlers;
};

// Setup all socket event handlers
export const setupSocketHandlers = () => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Handle joining a room
    socket.on("joinRoom", handleJoinRoom(socket));

    // Handle ready toggle
    socket.on("toggleReady", handleToggleReady(socket));

    // Handle progress update
    socket.on("updateProgress", handleUpdateProgress(socket));

    // Handle player finishing
    socket.on("playerFinished", handlePlayerFinished(socket));

    // Handle topic voting
    socket.on("submitVote", handleSubmitVote(socket));

    // Handle Play Again
    socket.on('requestPlayAgain', handleRequestPlayAgain(socket));

    // Handle Find Match
    socket.on("findMatch", data => matchmaking.handleFindMatch(socket, data));

    // Handle Cancel Matchmaking
    socket.on("cancelMatchmaking", () => matchmaking.handleCancelMatchmaking(socket));

    // Handle disconnection
    socket.on("disconnect", handleDisconnect(socket));
  });
};

// Handler for joinRoom event
const handleJoinRoom = (socket: Socket) => ({ roomId, userData }) => {
  console.log(`[Socket] User ${userData?.username} (${socket.id}) attempting to join room: ${roomId}`);
  const room = rooms[roomId];
  const userId = userData?.uid;
  const username = userData?.username;

  if (!room) {
    console.log(`[Socket] Room ${roomId} not found for user ${socket.id}`);
    socket.emit("roomNotFound");
    return;
  }

  if (!userId || !username) {
    console.log(`[Socket] Missing userId or username for user ${socket.id}`);
    socket.emit("error", { message: "User data incomplete." });
    return;
  }

  // Check player limit again (race condition safeguard)
  if (Object.keys(room.players).length >= room.playerLimit && !room.players[userId]) {
    console.log(`[Socket] Room ${roomId} is full. User ${socket.id} cannot join.`);
    socket.emit("error", { message: "Room is full." });
    return;
  }

  // Check if game already started
  if (room.status !== "waiting") {
    // Allow rejoining if the player was already in the room and is reconnecting
    if (!room.players[userId]) {
      console.log(`[Socket] Game in room ${roomId} already started. User ${socket.id} cannot join.`);
      socket.emit("error", { message: "Game has already started." });
      return;
    } else {
      console.log(`[Socket] Player ${username} (${userId}) rejoining room ${roomId}.`);
    }
  }

  socket.join(roomId);
  console.log(`[Socket] User ${username} (${socket.id}) joined socket room: ${roomId}`);

  // Add or update player in the room state
  if (!room.players[userId]) {
    console.log(`[Socket] Adding new player ${username} to room ${roomId}`);
    room.players[userId] = {
      id: userId,
      name: username,
      wpm: 0,
      accuracy: 100,
      progress: 0,
      ready: false,
      connected: true,
      finished: false,
    };
  } else {
    console.log(`[Socket] Updating existing player ${username} connection status in room ${roomId}`);
    room.players[userId].connected = true;
    room.players[userId].name = username; // Update name in case it changed
  }

  // Store userId on the socket object for easy access later (e.g., in disconnect)
  (socket as any).userId = userId;
  (socket as any).roomId = roomId;

  // Send current game state to the joining user
  // Avoid sending timers
  const roomDataToSend = { ...room };
  delete roomDataToSend.countdownTimer;
  delete roomDataToSend.votingTimer;
  socket.emit("gameUpdate", roomDataToSend);
  console.log(`[Socket] Sent initial gameUpdate to ${username} (${socket.id}) for room ${roomId}`);

  // Broadcast the updated room state to everyone after join
  roomManager.broadcastRoomUpdate(roomId);
};

// Handler for toggleReady event
const handleToggleReady = (socket: Socket) => () => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;
  console.log(`[Socket] Received toggleReady from user ${userId} in room ${roomId}`);
  
  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.log(`[Socket] Invalid toggleReady request: userId=${userId}, roomId=${roomId}`);
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  // Can only toggle ready in 'waiting' state
  if (room.status !== "waiting") {
    console.log(`[Socket] Cannot toggle ready in room ${roomId} (status: ${room.status})`);
    return;
  }

  player.ready = !player.ready;
  console.log(`[Socket] Player ${player.name} in room ${roomId} set ready state to ${player.ready}`);

  // Broadcast the updated player state immediately
  roomManager.broadcastRoomUpdate(roomId);

  // Check if all connected players are ready
  const connectedPlayers = Object.values(room.players).filter(p => p.connected);
  // Ensure minimum players are connected AND ready
  const allReady = connectedPlayers.length >= 2 && connectedPlayers.every(p => p.ready);

  if (allReady) {
    // Call the function to handle countdown logic
    roomManager.startCountdown(roomId);
  }
};

// Handler for updateProgress event
const handleUpdateProgress = (socket: Socket) => (data) => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) return;

  const room = rooms[roomId];
  const player = room.players[userId];

  // Only update during racing state
  if (room.status !== 'racing') return;

  // Basic validation
  if (typeof data.progress !== 'number' || typeof data.wpm !== 'number' || typeof data.accuracy !== 'number') {
    console.warn(`[Socket] Invalid progress data received from ${userId} in room ${roomId}:`, data);
    return;
  }

  player.progress = Math.max(0, Math.min(100, data.progress));
  player.wpm = Math.max(0, data.wpm);
  player.accuracy = Math.max(0, Math.min(100, data.accuracy));

  // Broadcast progress to others in the room (throttling might be needed)
  socket.to(roomId).emit("opponentProgress", {
    userId,
    progress: player.progress,
    wpm: player.wpm,
    // accuracy: player.accuracy // Maybe not needed for opponent view?
  });
};

// Handler for playerFinished event
const handlePlayerFinished = (socket: Socket) => (data) => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;
  console.log(`[Socket] Received playerFinished from ${userId} in room ${roomId}`);

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) return;

  const room = rooms[roomId];
  const player = room.players[userId];

  if (room.status !== 'racing' || player.finished) return; // Can only finish during race and only once

  player.finished = true;
  player.finishTime = Date.now();
  player.wpm = data.finalWpm ?? player.wpm; // Use final reported WPM
  player.accuracy = data.finalAccuracy ?? player.accuracy;
  player.progress = 100; // Ensure progress is 100

  console.log(`[Socket] Player ${player.name} finished in room ${roomId}. WPM: ${player.wpm}, Acc: ${player.accuracy}`);

  // Broadcast the update including the finished player
  roomManager.broadcastRoomUpdate(roomId);

  // --- Check if all connected players are finished --- 
  const connectedPlayers = Object.values(room.players).filter(p => p.connected);
  const allFinished = connectedPlayers.length > 0 && connectedPlayers.every(p => p.finished);

  if (allFinished) {
    console.log(`[Game End] All connected players finished in room ${roomId}. Setting status to finished.`);
    room.status = 'finished';
    
    // Optional: Determine winner (e.g., first to finish)
    let winnerId: string | undefined = undefined;
    let earliestFinishTime = Infinity;
    connectedPlayers.forEach(p => {
      if (p.finishTime && p.finishTime < earliestFinishTime) {
        earliestFinishTime = p.finishTime;
        winnerId = p.id;
      }
    });
    room.winner = winnerId; // Store the winner ID
    console.log(`[Game End] Winner for room ${roomId}: ${room.winner || 'None'}`);

    // Broadcast the final finished state
    roomManager.broadcastRoomUpdate(roomId);
    
    // TODO: Persist results to database? Clean up room after a delay?
  }
};

// Handler for submitVote event
const handleSubmitVote = (socket: Socket) => (data) => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;
  const topic = data?.topic;

  console.log(`[Socket] Received submitVote from ${userId} in room ${roomId} for topic ${topic}`);

  // --- Validation --- 
  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.log(`[Vote] Invalid request: userId=${userId}, roomId=${roomId}`);
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  if (room.status !== 'voting') {
    console.log(`[Vote] Cannot vote in room ${roomId} (status: ${room.status})`);
    return;
  }

  // Validate topic against available options
  if (!topic || !room.topicOptions?.includes(topic)) {
    console.log(`[Vote] Invalid topic voted for in room ${roomId}: ${topic}`);
    // Optionally send an error back to the client?
    // socket.emit('error', { message: 'Invalid topic selection.' });
    return;
  }

  // --- Update Player Vote --- 
  player.vote = topic;
  console.log(`[Vote] Player ${player.name} in room ${roomId} voted for ${topic}`);

  // Validate state, update player vote, check if voting ends, broadcast
  roomManager.broadcastRoomUpdate(roomId); // Broadcast the update

  // --- Check if all players have voted --- 
  const connectedPlayers = Object.values(room.players).filter(p => p.connected);
  const allVoted = connectedPlayers.length > 0 && connectedPlayers.every(p => !!p.vote);

  if (allVoted) {
    console.log(`[Vote] All connected players have voted in room ${roomId}. Ending voting early.`);
    // Actually call the function to end voting immediately
    roomManager.handleVotingEnd(roomId);
  }
};

// Handler for requestPlayAgain event
const handleRequestPlayAgain = (socket: Socket) => () => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.log(`[Play Again] Invalid request from socket ${socket.id}`);
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  // Can only request play again when game is finished
  if (room.status !== 'finished') {
    console.log(`[Play Again] Cannot request play again in room ${roomId} (status: ${room.status})`);
    return;
  }

  player.wantsPlayAgain = true;
  console.log(`[Play Again] Player ${player.name} wants to play again in room ${roomId}`);

  // Broadcast the update so UIs can show who wants to play again
  roomManager.broadcastRoomUpdate(roomId);

  // Check if all currently connected players want to play again
  const connectedPlayers = Object.values(room.players).filter(p => p.connected);
  const allWantToPlayAgain = connectedPlayers.length > 0 && connectedPlayers.every(p => p.wantsPlayAgain);

  if (allWantToPlayAgain) {
    console.log(`[Play Again] All connected players want to play again in room ${roomId}. Starting topic voting.`);
    // --- INITIATE VOTING --- 
    roomManager.startTopicVotingWithDeps(roomId);
  }
};

// Handler for disconnect event
const handleDisconnect = (socket: Socket) => async (reason: string) => {
  console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  // --- Clean up matchmaking queue on disconnect ---
  await matchmaking.handleDisconnectCleanup(socket);

  if (userId && roomId && rooms[roomId] && rooms[roomId].players[userId]) {
    const room = rooms[roomId];
    const player = room.players[userId];
    console.log(`[Socket] Handling disconnect for player ${player.name} (${userId}) in room ${roomId}`);

    player.connected = false;
    player.ready = false; // Player is no longer ready if they disconnect

    // Notify others in the room
    roomManager.broadcastRoomUpdate(roomId); // Send full update

    // --- Add logic to handle countdown/voting cancellation on disconnect --- 
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    console.log(`[Disconnect] Connected players in room ${roomId}: ${connectedPlayers.length}`);

    // If player count drops below minimum during countdown or voting, cancel and return to waiting
    if ((room.status === 'countdown' || room.status === 'voting') && connectedPlayers.length < 2) {
      console.log(`[Disconnect] Player count in room ${roomId} dropped below 2 during ${room.status}. Returning to waiting.`);
      // Clear any active timers
      if (room.countdownTimer) {
        clearTimeout(room.countdownTimer);
        room.countdownTimer = undefined;
        console.log(`[Disconnect] Cleared countdown timer for room ${roomId}`);
      }
      if (room.votingTimer) {
        clearTimeout(room.votingTimer);
        room.votingTimer = undefined;
        console.log(`[Disconnect] Cleared voting timer for room ${roomId}`);
      }
      // Reset relevant state fields
      room.status = 'waiting';
      room.countdownStartedAt = undefined;
      room.votingEndTime = undefined;
      room.startTime = undefined;
      // Reset player ready/vote states
      Object.values(room.players).forEach(p => {
        p.ready = false;
        p.vote = undefined;
      });
      // Broadcast the change back to waiting state
      roomManager.broadcastRoomUpdate(roomId);
    }

    // 3. Clean up empty rooms (run this check LAST)
    // Check connectedPlayers again AFTER potential state changes
    const finalConnectedPlayers = Object.values(room.players).filter(p => p.connected);
    if (finalConnectedPlayers.length === 0) {
      // Check if the room was just finished
      if (room.status === 'finished') {
        console.log(`[Socket] Room ${roomId} is empty and finished. Scheduling deletion in 5 seconds.`);
        // Delay deletion slightly to allow for potential UI updates or quick reconnects
        setTimeout(() => {
          // Re-check if room still exists and is STILL empty before deleting
          const checkRoom = rooms[roomId];
          if (checkRoom && Object.values(checkRoom.players).filter(p => p.connected).length === 0) {
            console.log(`[Socket] Deleting empty finished room ${roomId} after delay.`);
            if (checkRoom.countdownTimer) clearTimeout(checkRoom.countdownTimer);
            if (checkRoom.votingTimer) clearTimeout(checkRoom.votingTimer);
            delete rooms[roomId];
          } else {
            console.log(`[Socket] Deletion cancelled for room ${roomId}, player reconnected or room deleted elsewhere.`);
          }
        }, 5000); // 5 second delay
      } else {
        // If empty and not finished, delete immediately
        console.log(`[Socket] Room ${roomId} is empty (status: ${room.status}). Deleting immediately.`);
        if (room.countdownTimer) clearTimeout(room.countdownTimer);
        if (room.votingTimer) clearTimeout(room.votingTimer);
        delete rooms[roomId];
        // No broadcast needed for a deleted room
      }
    }
  } else {
    console.log(`[Socket] Disconnected socket ${socket.id} had no associated user/room state or room ${roomId} was already deleted.`);
  }
}; 