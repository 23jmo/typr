import { Server } from "socket.io";
import { 
  COUNTDOWN_DURATION_MS, 
  startTopicVoting, 
  createHandleVotingEnd 
} from './topics';
import { RoomData } from './types';

// References to external dependencies to avoid circular references
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};

// Initialize the module with dependencies
export const initRoomManager = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData }
) => {
  io = ioRef;
  rooms = roomsRef;
  
  // Create the handleVotingEnd function with available dependencies
  const handleVotingEnd = createHandleVotingEnd(rooms, broadcastRoomUpdate, startCountdown);
  
  console.log('[RoomManager] Module initialized');
  return {
    broadcastRoomUpdate,
    startCountdown,
    resetRoomForNewGame,
    startTopicVotingWithDeps: (roomId: string) => startTopicVoting(roomId, rooms, broadcastRoomUpdate, handleVotingEnd),
    handleVotingEnd  // Expose the function for direct access
  };
};

// Broadcast room updates to all connected clients in the room
export const broadcastRoomUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (room) {
    // Avoid sending timers over socket
    const roomDataToSend = { ...room };
    delete roomDataToSend.countdownTimer;
    delete roomDataToSend.votingTimer;
    io.to(roomId).emit("gameUpdate", roomDataToSend);
    console.log(`[Room: ${roomId}] Broadcasted gameUpdate`);
  }
};

// Start the countdown phase for a room
export const startCountdown = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) {
    console.log(`[Countdown] Room ${roomId} not found.`);
    return;
  }
  // Check for states that should PREVENT scheduling the end of countdown
  if (room.status === 'racing' || room.status === 'finished') { 
    console.log(`[Countdown] Cannot schedule end for room ${roomId}. Invalid Status: ${room.status}`);
    return;
  }
  // If status is 'waiting' or 'voting', we initiate the countdown.
  // If status is already 'countdown', we just ensure the timeout is set.
  if (room.status !== 'countdown') {
    console.log(`[Countdown] Initiating countdown for room ${roomId} from status: ${room.status}`); 
    room.status = 'countdown';
    room.countdownStartedAt = Date.now();
    // Reset player ready states if transitioning from waiting/voting (optional but good practice)
    Object.values(room.players).forEach(p => p.ready = false); 
    // Broadcast the countdown start if it wasn't already in countdown
    broadcastRoomUpdate(roomId);
  } else {
    console.log(`[Countdown] Room ${roomId} is already in countdown. Ensuring timeout is set.`);
  }

  // Clear any existing *countdown* timer before setting a new one
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    console.log(`[Countdown] Cleared existing countdown timer for room ${roomId}`);
  }

  // Schedule the transition to racing
  console.log(`[Countdown] Scheduling transition to racing for room ${roomId} in ${COUNTDOWN_DURATION_MS}ms`);
  room.countdownTimer = setTimeout(() => {
    const currentRoom = rooms[roomId]; // Re-fetch room state
    // Check if room still exists and is still in countdown phase
    if (currentRoom && currentRoom.status === 'countdown') {
      console.log(`[Countdown] Countdown finished for room ${roomId}. Transitioning to racing.`);
      currentRoom.status = 'racing';
      currentRoom.startTime = Date.now(); // Set the official race start time
      currentRoom.countdownStartedAt = undefined; // Clear countdown start time
      currentRoom.countdownTimer = undefined; // Clear the timer handle
      // Broadcast the racing state
      broadcastRoomUpdate(roomId);
    } else {
      console.log(`[Countdown] Countdown timer fired for room ${roomId}, but state was not 'countdown' or room deleted. No action taken.`);
    }
  }, COUNTDOWN_DURATION_MS);
};

// Reset a room for a new game
export const resetRoomForNewGame = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;

  console.log(`[Reset] Resetting room ${roomId} for new game.`);

  room.status = 'waiting';
  room.winner = undefined;
  room.startTime = undefined;
  room.countdownStartedAt = undefined;
  room.votingEndTime = undefined;
  // Decide if you want to keep the same text or regenerate/vote
  // For now, let's keep the text simple. Could add voting later.
  // room.text = generateNewText(...)

  // Reset player states
  Object.values(room.players).forEach(p => {
    p.progress = 0;
    p.wpm = 0;
    p.accuracy = 100;
    p.finished = false;
    p.finishTime = undefined;
    p.ready = false; // Players must ready up again
    p.vote = undefined;
    p.wantsPlayAgain = undefined; // Clear the flag
  });

  // Broadcast the reset state
  broadcastRoomUpdate(roomId);
}; 