import { Server } from "socket.io";
import { 
  COUNTDOWN_DURATION_MS, 
  startTopicVoting, 
  createHandleVotingEnd 
} from './topics';
import { RoomData } from './types';

// Default time limit for ranked games in seconds
export const DEFAULT_RANKED_TIME_LIMIT = 30;

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
    handleVotingEnd,  // Expose the function for direct access
    startRaceTimer    // Expose race timer function
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
    delete roomDataToSend.raceTimer; // Also delete race timer
    io.to(roomId).emit("gameUpdate", roomDataToSend);
    console.log(`[Room: ${roomId}] Broadcasted gameUpdate`);
  }
};

// Start a timer to end the race after the room's time limit
export const startRaceTimer = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) {
    console.log(`[RaceTimer] Room ${roomId} not found.`);
    return;
  }
  
  // Use the room's timeLimit or default to 30 seconds for ranked games
  const timeLimit = room.timeLimit || (room.isRanked ? DEFAULT_RANKED_TIME_LIMIT : 60);
  const timeLimitMs = timeLimit * 1000; // Convert seconds to milliseconds
  
  console.log(`[RaceTimer] Starting race timer for room ${roomId}. Time limit: ${timeLimit} seconds`);
  
  // Clear any existing race timer before setting a new one
  if (room.raceTimer) {
    clearTimeout(room.raceTimer);
    console.log(`[RaceTimer] Cleared existing race timer for room ${roomId}`);
  }
  
  // Set a timer to end the race after the time limit
  room.raceTimer = setTimeout(() => {
    const currentRoom = rooms[roomId]; // Re-fetch room state
    // Check if room still exists and is still in racing phase
    if (currentRoom && currentRoom.status === 'racing') {
      console.log(`[RaceTimer] Time limit reached for room ${roomId}. Finishing race.`);
      
      // Find any players who haven't finished yet
      const unfinishedPlayers = Object.values(currentRoom.players).filter(p => !p.finished);
      
      // Mark all unfinished players with their current progress
      unfinishedPlayers.forEach(player => {
        player.finished = true;
        player.finishTime = Date.now();
      });
      
      // Determine the winner (player with highest progress)
      if (!currentRoom.winner) {
        const players = Object.entries(currentRoom.players);
        if (players.length > 0) {
          const sortedPlayers = players
            .filter(([_, player]) => player.connected) // Only consider connected players
            .sort(([_id1, a], [_id2, b]) => {
              // First by progress (desc)
              if (b.progress !== a.progress) return b.progress - a.progress;
              // Then by finish time (asc) if both have finished
              if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
              // Finished players ranked above unfinished
              if (a.finishTime && !b.finishTime) return -1;
              if (!a.finishTime && b.finishTime) return 1;
              // If neither finished, sort by current WPM
              return b.wpm - a.wpm;
            });
          
          // Set the winner
          if (sortedPlayers.length > 0) {
            currentRoom.winner = sortedPlayers[0][0];
            console.log(`[RaceTimer] Winner determined for room ${roomId}: ${currentRoom.winner}`);
          }
        }
      }
      
      // Change room status to finished
      currentRoom.status = 'finished';
      currentRoom.raceTimer = undefined; // Clear the timer handle
      
      // Broadcast the finished state
      broadcastRoomUpdate(roomId);
    } else {
      console.log(`[RaceTimer] Race timer fired for room ${roomId}, but state was not 'racing' or room deleted. No action taken.`);
    }
  }, timeLimitMs);
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
      
      // Start the race timer when transitioning to racing
      startRaceTimer(roomId);
      
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

  // Clear any active timers
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = undefined;
  }
  if (room.votingTimer) {
    clearTimeout(room.votingTimer);
    room.votingTimer = undefined;
  }
  if (room.raceTimer) {
    clearTimeout(room.raceTimer);
    room.raceTimer = undefined;
  }

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