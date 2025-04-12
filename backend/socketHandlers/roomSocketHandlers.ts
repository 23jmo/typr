import { Server, Socket } from "socket.io";
import { RoomData } from '../types';

interface JoinRoomData {
  roomId: string;
  userData: {
    uid: string;
    username: string;
  };
}

interface VoteData {
  topic: string;
}

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let roomManager: any;

// Initialize the module with required dependencies
export const initRoomSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  roomManagerRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  roomManager = roomManagerRef;
  
  console.log('[RoomSocketHandlers] Module initialized');
  return {
    setupRoomSocketHandlers,
    handleJoinRoom,
    handleSubmitVote,
    handleDisconnect
  };
};

// Setup room-related socket event handlers
export const setupRoomSocketHandlers = (socket: Socket) => {
  // Handle joining a room
  socket.on("joinRoom", handleJoinRoom(socket));

  // Handle topic voting
  socket.on("submitVote", handleSubmitVote(socket));

  // Handle disconnection
  socket.on("disconnect", handleDisconnect(socket));
};

// Handler for joinRoom event
export const handleJoinRoom = (socket: Socket) => ({ roomId, userData }: JoinRoomData) => {
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

// Handler for submitVote event
export const handleSubmitVote = (socket: Socket) => (data: VoteData) => {
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

// Handler for disconnect event
export const handleDisconnect = (socket: Socket) => async (reason: string) => {
  console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  if (userId && roomId && rooms[roomId] && rooms[roomId].players[userId]) {
    const room = rooms[roomId];
    const player = room.players[userId];
    console.log(`[Socket] Handling disconnect for player ${player.name} (${userId}) in room ${roomId}`);

    player.connected = false;
    player.ready = false; // Player is no longer ready if they disconnect

    // Notify others in the room
    roomManager.broadcastRoomUpdate(roomId); // Send full update

    // --- Only cancel or reset game state for waiting, countdown or voting --- 
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    console.log(`[Disconnect] Connected players in room ${roomId}: ${connectedPlayers.length}, room status: ${room.status}`);

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
    
    // Special handling for racing rooms when a player disconnects
    if (room.status === 'racing') {
      // Check if game should end because all remaining players have finished
      const remainingPlayers = Object.values(room.players).filter(p => p.connected);
      const allRemainingFinished = remainingPlayers.length > 0 && remainingPlayers.every(p => p.finished);
      
      if (allRemainingFinished) {
        console.log(`[Disconnect] All remaining players in racing room ${roomId} have finished. Setting status to finished.`);
        room.status = 'finished';
        
        // Determine winner based on finish time
        let winnerId: string | undefined = undefined;
        let earliestFinishTime = Infinity;
        Object.values(room.players).forEach(p => {
          if (p.finished && p.finishTime && p.finishTime < earliestFinishTime) {
            earliestFinishTime = p.finishTime;
            winnerId = p.id;
          }
        });
        room.winner = winnerId;
        roomManager.broadcastRoomUpdate(roomId);
      }
    }

    // 3. Clean up empty rooms (run this check LAST)
    // Check connectedPlayers again AFTER potential state changes
    const finalConnectedPlayers = Object.values(room.players).filter(p => p.connected);
    if (finalConnectedPlayers.length === 0) {
      // Check if the room was just finished
      if (room.status === 'finished' || room.status === 'racing') {
        console.log(`[Socket] Room ${roomId} is empty and ${room.status}. Scheduling deletion in 10 seconds.`);
        // Delay deletion to allow for potential reconnects
        setTimeout(() => {
          // Re-check if room still exists and is STILL empty before deleting
          const checkRoom = rooms[roomId];
          if (checkRoom && Object.values(checkRoom.players).filter(p => p.connected).length === 0) {
            console.log(`[Socket] Deleting empty ${checkRoom.status} room ${roomId} after delay.`);
            if (checkRoom.countdownTimer) clearTimeout(checkRoom.countdownTimer);
            if (checkRoom.votingTimer) clearTimeout(checkRoom.votingTimer);
            delete rooms[roomId];
          } else {
            console.log(`[Socket] Deletion cancelled for room ${roomId}, player reconnected or room deleted elsewhere.`);
          }
        }, 10000); // 10 second delay for racing/finished rooms
      } else {
        // If empty and not racing/finished, delete after a short delay
        console.log(`[Socket] Room ${roomId} is empty (status: ${room.status}). Scheduling deletion in 5 seconds.`);
        setTimeout(() => {
          // Re-check if room still exists and is STILL empty before deleting
          const checkRoom = rooms[roomId];
          if (checkRoom && Object.values(checkRoom.players).filter(p => p.connected).length === 0) {
            console.log(`[Socket] Deleting empty ${checkRoom.status} room ${roomId} after short delay.`);
            if (checkRoom.countdownTimer) clearTimeout(checkRoom.countdownTimer);
            if (checkRoom.votingTimer) clearTimeout(checkRoom.votingTimer);
            delete rooms[roomId];
          }
        }, 5000); // 5 second delay for other room states
      }
    }
  } else {
    console.log(`[Socket] Disconnected socket ${socket.id} had no associated user/room state or room ${roomId} was already deleted.`);
  }
}; 