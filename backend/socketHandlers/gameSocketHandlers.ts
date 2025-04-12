import { Server, Socket } from "socket.io";
import { RoomData } from '../types';

interface ProgressData {
  progress: number;
  wpm: number;
  accuracy: number;
}

interface FinishData {
  finalWpm?: number;
  finalAccuracy?: number;
}

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let roomManager: any;

// Initialize the module with required dependencies
export const initGameSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  roomManagerRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  roomManager = roomManagerRef;
  
  console.log('[GameSocketHandlers] Module initialized');
  return {
    setupGameSocketHandlers,
    handleToggleReady,
    handleUpdateProgress,
    handlePlayerFinished,
    handleRequestPlayAgain
  };
};

// Setup game-related socket event handlers
export const setupGameSocketHandlers = (socket: Socket) => {
  // Handle ready toggle
  socket.on("toggleReady", handleToggleReady(socket));

  // Handle progress update
  socket.on("updateProgress", handleUpdateProgress(socket));

  // Handle player finishing
  socket.on("playerFinished", handlePlayerFinished(socket));

  // Handle Play Again
  socket.on('requestPlayAgain', handleRequestPlayAgain(socket));
};

// Handler for toggleReady event
export const handleToggleReady = (socket: Socket) => () => {
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
export const handleUpdateProgress = (socket: Socket) => (data: ProgressData) => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.warn(`[Socket] Invalid progress update: userId=${userId}, roomId=${roomId}`);
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  // Only update during racing state
  if (room.status !== 'racing') {
    console.warn(`[Socket] Progress update rejected - room ${roomId} not in racing state (${room.status})`);
    return;
  }

  // Basic validation
  if (typeof data.progress !== 'number' || typeof data.wpm !== 'number' || typeof data.accuracy !== 'number') {
    console.warn(`[Socket] Invalid progress data received from ${userId} in room ${roomId}:`, data);
    return;
  }

  player.progress = Math.max(0, Math.min(100, data.progress));
  player.wpm = Math.max(0, data.wpm);
  player.accuracy = Math.max(0, Math.min(100, data.accuracy));

  console.log(`[Socket] Updated progress for ${player.name} in room ${roomId}: ${player.progress}%, WPM: ${player.wpm}`);

  // Broadcast progress to others in the room
  socket.to(roomId).emit("opponentProgress", {
    userId,
    progress: player.progress,
    wpm: player.wpm,
  });
};

// Handler for playerFinished event
export const handlePlayerFinished = (socket: Socket) => (data: FinishData) => {
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

  // --- Check if all active players in the race have finished --- 
  const allPlayers = Object.values(room.players);
  const activePlayers = allPlayers.filter(p => p.connected);
  const allActivePlayersFinished = activePlayers.length > 0 && activePlayers.every(p => p.finished);
  
  // Only transition to finished state if ALL active players have completed the race
  if (allActivePlayersFinished) {
    console.log(`[Game End] All active players (${activePlayers.length}/${allPlayers.length}) finished in room ${roomId}. Setting status to finished.`);
    room.status = 'finished';
    
    // Optional: Determine winner (e.g., first to finish)
    let winnerId: string | undefined = undefined;
    let earliestFinishTime = Infinity;
    activePlayers.forEach(p => {
      if (p.finishTime && p.finishTime < earliestFinishTime) {
        earliestFinishTime = p.finishTime;
        winnerId = p.id;
      }
    });
    room.winner = winnerId; // Store the winner ID
    console.log(`[Game End] Winner for room ${roomId}: ${room.winner || 'None'}`);

    // Broadcast the final finished state
    roomManager.broadcastRoomUpdate(roomId);
  } else {
    console.log(`[Game Progress] ${activePlayers.filter(p => p.finished).length}/${activePlayers.length} active players have finished in room ${roomId}`);
  }
};

// Handler for requestPlayAgain event
export const handleRequestPlayAgain = (socket: Socket) => () => {
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