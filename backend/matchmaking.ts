import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { generateRandomText } from "./topics";
import { RoomData } from "./types";

// --- Matchmaking Queue (Redis Key) ---
export const MATCHMAKING_QUEUE_KEY = "matchmakingQueue";

// --- Matchmaking Player Data ---
export interface MatchmakingPlayerData {
  userId: string;
  username: string;
  elo: number;
  socketId: string; // Store socket ID to communicate directly
  timestamp: number; // Time they entered the queue
}

// --- Core Matchmaking Logic ---
export const ELO_RANGE = 500; // Match players within 500 ELO points
export const MAX_WAIT_TIME_SECONDS = 60; // Max time a player waits before widening search (optional)

// References to external dependencies to avoid circular references
let redisClient: RedisClientType;
let rooms: { [roomId: string]: RoomData } = {};
let io: Server;
let startCountdown: (roomId: string) => void;

// Initialize the module with necessary dependencies
export const initMatchmaking = (
  redisClientRef: RedisClientType,
  roomsRef: { [roomId: string]: RoomData },
  ioRef: Server,
  startCountdownRef: (roomId: string) => void
) => {
  redisClient = redisClientRef;
  rooms = roomsRef;
  io = ioRef;
  startCountdown = startCountdownRef;

  console.log("[Matchmaking] Module initialized");
  return {
    tryMatchmaking,
    getRedisClient,
  };
};

// Provide access to the Redis client for socket handlers
export const getRedisClient = () => {
  return redisClient;
};

// Core matchmaking algorithm
export const tryMatchmaking = async (playerData: MatchmakingPlayerData) => {
  console.log(
    `[Matchmaking] Attempting to find match for ${playerData.username} (ELO: ${playerData.elo})`
  );
  if (!redisClient.isReady) {
    console.error("[Matchmaking] Redis client not ready.");
    return; // Cannot proceed without Redis
  }

  const { userId, username, elo, socketId } = playerData;

  // Define the ELO search range
  const minElo = elo - ELO_RANGE;
  const maxElo = elo + ELO_RANGE;

  try {
    // Debug log current queue
    try {
      const allMembers = await redisClient.zRangeWithScores(
        MATCHMAKING_QUEUE_KEY,
        0,
        -1
      );
      console.log(
        `[Matchmaking Debug] Current full queue before range search (${allMembers.length} members):`,
        JSON.stringify(allMembers)
      );
    } catch (debugError) {
      console.error(
        "[Matchmaking Debug] Error fetching full queue:",
        debugError
      );
    }

    // 1. Find potential opponents in the queue within the ELO range
    console.log(
      `[Matchmaking Debug] Querying Redis for range using zRangeByScoreWithScores: Key=${MATCHMAKING_QUEUE_KEY}, MinSCORE=${minElo}, MaxSCORE=${maxElo}`
    );
    const potentialOpponents = await redisClient.zRangeByScoreWithScores(
      MATCHMAKING_QUEUE_KEY,
      minElo,
      maxElo
    );

    console.log(
      `[Matchmaking] Found ${
        potentialOpponents.length
      } potential opponents for ${username} in range [${minElo}-${maxElo}]. Raw result: ${JSON.stringify(
        potentialOpponents
      )}`
    );

    let opponentData: MatchmakingPlayerData | null = null;
    let opponentQueueEntry: string | null = null; // Store the raw string from Redis

    // 2. Iterate through potential opponents (excluding self)
    for (const opponent of potentialOpponents) {
      // opponent.value is the stringified MatchmakingPlayerData
      // opponent.score is the ELO
      const parsedOpponent = JSON.parse(
        opponent.value
      ) as MatchmakingPlayerData;

      // Don't match with self
      if (parsedOpponent.userId === userId) {
        continue;
      }

      // Basic check: ensure opponent is still connected
      const opponentSocket = io.sockets.sockets.get(parsedOpponent.socketId);
      if (!opponentSocket) {
        console.warn(
          `[Matchmaking] Found potential opponent ${parsedOpponent.username} (${parsedOpponent.userId}) but their socket ${parsedOpponent.socketId} is disconnected. Removing from queue.`
        );
        // Clean up stale entry
        await redisClient.zRem(MATCHMAKING_QUEUE_KEY, opponent.value);
        continue;
      }

      console.log(
        `[Matchmaking] Found suitable opponent: ${parsedOpponent.username} (ELO: ${opponent.score}) for ${username}`
      );
      opponentData = parsedOpponent;
      opponentQueueEntry = opponent.value;
      break; // Found a match, stop searching
    }

    // 3. If an opponent was found
    if (opponentData && opponentQueueEntry) {
      console.log(
        `[Matchmaking] Match found: ${username} vs ${opponentData.username}`
      );

      // 4. Remove both players from the queue atomically
      const playerQueueEntry = JSON.stringify(playerData);
      const removedCount = await redisClient.zRem(MATCHMAKING_QUEUE_KEY, [
        playerQueueEntry,
        opponentQueueEntry,
      ]);

      if (removedCount < 2) {
        // This could happen if the opponent disconnected *just* before ZREM
        console.warn(
          `[Matchmaking] Failed to remove both players from queue (removed ${removedCount}). One might have disconnected or been matched already. Aborting match.`
        );
        // If we removed the current player but not the opponent, add opponent back? Complex recovery.
        // For now, just abort. The other player might find another match later.
        return;
      }
      console.log(
        `[Matchmaking] Removed ${username} and ${opponentData.username} from queue.`
      );

      // 5. Create a new room
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log(`[Matchmaking] Creating room ${roomId} for the match.`);
      const roomText = generateRandomText(10); // Generate 10 words for the match

      const newRoom: RoomData = {
        id: roomId,
        name: `Ranked Match ${roomId}`,
        status: "countdown", // Start directly in countdown
        createdAt: Date.now(),
        timeLimit: 60, // Standard 1 minute for ranked
        textLength: roomText.split(" ").length, // Approx word count
        playerLimit: 2,
        isRanked: true,
        players: {
          [userId]: {
            id: userId,
            name: username,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            ready: true, // Auto-ready for ranked
            connected: true,
            finished: false,
          },
          [opponentData.userId]: {
            id: opponentData.userId,
            name: opponentData.username,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            ready: true, // Auto-ready for ranked
            connected: true,
            finished: false,
          },
        },
        text: roomText,
        textSource: "random",
        topic: null,
        hostId: userId, // Assign host arbitrarily
        countdownStartedAt: Date.now(), // Set countdown start time immediately
        initialElo: {
          [userId]: elo,
          [opponentData.userId]: opponentData.elo,
        },
        // Timers will be set by startCountdown
      };

      rooms[roomId] = newRoom;
      console.log(
        `[Matchmaking] Room ${roomId} created with status 'countdown'.`
      );

      // 6. Notify both players about the match found
      io.to(socketId).emit("matchFound", { roomId });
      io.to(opponentData.socketId).emit("matchFound", { roomId });
      console.log(
        `[Matchmaking] Sent 'matchFound' to ${username} (${socketId}) and ${opponentData.username} (${opponentData.socketId}) for room ${roomId}`
      );

      // 7. Add players to the Socket.IO room
      const playerSocket = io.sockets.sockets.get(socketId);
      const opponentSocket = io.sockets.sockets.get(opponentData.socketId);

      if (playerSocket) {
        playerSocket.join(roomId);
        (playerSocket as any).userId = userId;
        (playerSocket as any).roomId = roomId;
        console.log(
          `[Matchmaking] Added ${username} (${socketId}) to socket room ${roomId}`
        );
      } else {
        console.warn(
          `[Matchmaking] Could not find socket ${socketId} for player ${username} to join room ${roomId}`
        );
      }

      if (opponentSocket) {
        opponentSocket.join(roomId);
        (opponentSocket as any).userId = opponentData.userId;
        (opponentSocket as any).roomId = roomId;
        console.log(
          `[Matchmaking] Added ${opponentData.username} (${opponentData.socketId}) to socket room ${roomId}`
        );
      } else {
        console.warn(
          `[Matchmaking] Could not find socket ${opponentData.socketId} for opponent ${opponentData.username} to join room ${roomId}`
        );
      }

      // Small delay before scheduling the end of countdown
      setTimeout(() => {
        console.log(
          `[Matchmaking] Scheduling end of countdown for matched room ${roomId}`
        );
        // Call startCountdown to set the timeout for the transition to 'racing'
        startCountdown(roomId);
      }, 500); // Delay for client sync
    } else {
      console.log(
        `[Matchmaking] No suitable opponent found for ${username} yet.`
      );
      // Player remains in the queue
    }
  } catch (error) {
    console.error("[Matchmaking] Error during matchmaking attempt:", error);
  }
};
