import { Server, Socket } from "socket.io";
import { RoomData } from '../types';
import { MatchmakingPlayerData, MATCHMAKING_QUEUE_KEY } from '../matchmaking';

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let matchmaking: any; // Core matchmaking functions
let redisClient: any; // Redis client to be passed from matchmaking

// Initialize the module with required dependencies
export const initMatchmakingSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  matchmakingRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  matchmaking = matchmakingRef;
  
  // Get redisClient reference from matchmaking module
  redisClient = matchmakingRef.getRedisClient();
  
  console.log('[MatchmakingSocketHandlers] Module initialized');
  return {
    setupMatchmakingSocketHandlers,
    handleFindMatch,
    handleCancelMatchmaking,
    handleDisconnectCleanup
  };
};

// Setup matchmaking-related socket event handlers
export const setupMatchmakingSocketHandlers = (socket: Socket) => {
  // Handle Find Match
  socket.on("findMatch", (data) => handleFindMatch(socket, data));

  // Handle Cancel Matchmaking
  socket.on("cancelMatchmaking", () => handleCancelMatchmaking(socket));
};

// Socket handler for find match request
export const handleFindMatch = async (socket: Socket, data: any) => {
  // Basic validation
  if (!data || !data.userId || !data.username || data.elo === undefined || data.elo === null) {
    console.warn(`[Socket] Invalid findMatch request from ${socket.id}:`, data);
    socket.emit("matchmakingError", { message: "Invalid user data provided for matchmaking." });
    return;
  }
  if (!redisClient.isReady) {
    console.error("[Socket findMatch] Redis client not ready.");
    socket.emit("matchmakingError", { message: "Matchmaking service temporarily unavailable. Please try again soon." });
    return;
  }

  const { userId, username, elo } = data;
  const playerData: MatchmakingPlayerData = {
    userId,
    username,
    elo,
    socketId: socket.id,
    timestamp: Date.now(),
  };

  try {
    console.log(`[Socket] User ${username} (${userId}, ELO: ${elo}) requested findMatch.`);
     
    // --- BEGIN PREVENT DUPLICATES --- 
    console.log(`[Socket] Checking for existing queue entries for userId: ${userId}`);
    const queueMembers = await redisClient.zRange(MATCHMAKING_QUEUE_KEY, 0, -1);
    const entriesToRemove: string[] = [];
    for (const member of queueMembers) {
      try {
        const parsedMember = JSON.parse(member) as MatchmakingPlayerData;
        if (parsedMember.userId === userId) {
          console.log(`[Socket] Found existing entry for ${userId} (socket: ${parsedMember.socketId}). Marking for removal.`);
          entriesToRemove.push(member);
        }
      } catch (parseError) {
        console.error(`[Socket findMatch Pre-Check] Error parsing queue member: ${member}`, parseError);
        // Optionally remove malformed entry to keep queue clean
        entriesToRemove.push(member); 
      }
    }
    if (entriesToRemove.length > 0) {
      console.log(`[Socket] Removing ${entriesToRemove.length} stale queue entries for ${userId}.`);
      await redisClient.zRem(MATCHMAKING_QUEUE_KEY, entriesToRemove);
    }
    // --- END PREVENT DUPLICATES --- 

    // Add player to the sorted set (queue) with ELO as the score
    const newQueueEntry = JSON.stringify(playerData);
    await redisClient.zAdd(MATCHMAKING_QUEUE_KEY, {
      score: elo,
      value: newQueueEntry,
    });
    console.log(`[Socket] Added ${username} (socket: ${socket.id}) to matchmaking queue.`);
    socket.emit("searchingForMatch"); // Inform client they are now searching

    // Store userId on socket for later reference
    (socket as any).userId = userId; 

    // Attempt to find a match using core matchmaking functionality
    await matchmaking.tryMatchmaking(playerData);
  } catch (error) {
    console.error(`[Socket] Error during findMatch for user ${username}:`, error);
    socket.emit("matchmakingError", { message: "Failed to enter matchmaking. Please try again." });
  }
};

// Socket handler for canceling matchmaking
export const handleCancelMatchmaking = async (socket: Socket) => {
  const userId = (socket as any).userId;
  const socketId = socket.id;
  console.log(`[Socket] Received cancelMatchmaking from socket ${socketId}, user ID might be ${userId}`);

  if (!redisClient.isReady) {
    console.error("[Socket cancelMatchmaking] Redis client not ready.");
    return;
  }

  try {
    // Retrieve all entries
    const queueMembers = await redisClient.zRange(MATCHMAKING_QUEUE_KEY, 0, -1);
    let entryToRemove: string | null = null;
    for (const member of queueMembers) {
      try {
        const parsedMember = JSON.parse(member) as MatchmakingPlayerData;
        if (parsedMember.socketId === socketId) {
          entryToRemove = member;
          console.log(`[Socket] Found entry to remove for cancelMatchmaking: ${parsedMember.username}`);
          break;
        }
      } catch (parseError) {
        console.error(`[Socket cancelMatchmaking] Error parsing queue member: ${member}`, parseError);
      }
    }

    if (entryToRemove) {
      const removedCount = await redisClient.zRem(MATCHMAKING_QUEUE_KEY, entryToRemove);
      if (removedCount > 0) {
        console.log(`[Socket] Removed user (socket: ${socketId}) from matchmaking queue successfully.`);
        socket.emit("matchmakingCancelled"); // Confirm cancellation
      } else {
        console.log(`[Socket] Could not remove user (socket: ${socketId}) from queue (maybe already matched or removed).`);
      }
    } else {
      console.log(`[Socket] User (socket: ${socketId}) requested cancelMatchmaking but was not found in the queue.`);
    }
  } catch (error) {
    console.error(`[Socket] Error cancelling matchmaking for socket ${socketId}:`, error);
  }
};

// Handle cleanup when a socket disconnects
export const handleDisconnectCleanup = async (socket: Socket) => {
  const socketId = socket.id;
  console.log(`[Disconnect] Checking matchmaking queue for disconnected socket ${socketId}`);

  if (!redisClient.isReady) {
    console.warn(`[Disconnect] Redis client not ready, cannot clean matchmaking queue for socket ${socketId}`);
    return;
  }
  
  try {
    const queueMembers = await redisClient.zRange(MATCHMAKING_QUEUE_KEY, 0, -1);
    let entryToRemove: string | null = null;
    for (const member of queueMembers) {
      try {
        const parsedMember = JSON.parse(member) as MatchmakingPlayerData;
        if (parsedMember.socketId === socketId) {
          entryToRemove = member;
          console.log(`[Disconnect] Found disconnected user ${parsedMember.username} in matchmaking queue. Removing.`);
          break;
        }
      } catch (parseError) {
        console.error(`[Disconnect] Error parsing queue member during disconnect cleanup: ${member}`, parseError);
      }
    }
    if (entryToRemove) {
      await redisClient.zRem(MATCHMAKING_QUEUE_KEY, entryToRemove);
      console.log(`[Disconnect] Removed user (socket: ${socketId}) from matchmaking queue.`);
    } else {
      console.log(`[Disconnect] Disconnected user (socket: ${socketId}) was not in the matchmaking queue.`);
    }
  } catch (error) {
    console.error(`[Disconnect] Error cleaning matchmaking queue for socket ${socketId}:`, error);
  }
}; 