import { Server, Socket } from "socket.io";
import * as http from 'http'; // Correct import for built-in module
import OpenAI from "openai";
import { createClient, RedisClientType } from 'redis'; // Import Redis

require("dotenv").config();
const express = require("express");
const cors = require("cors");
// Remove axios if no longer needed, OpenAI might still be used for text generation
// const axios = require("axios");

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- Redis Client Setup ---
const redisClient: RedisClientType = createClient({
  // Use redis:// for non-TLS, rediss:// for TLS
  url: `redis://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.on('error', (err) => console.error('[Redis] Client Error', err));

// Connect to Redis (handle async connection)
(async () => {
  try {
    await redisClient.connect();
    console.log('[Redis] Client Connected');
  } catch (err) {
    console.error('[Redis] Could not connect to Redis:', err);
  }
})();

// --- Socket.io Setup ---
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now, restrict in production
    methods: ["GET", "POST"],
  },
});

// --- In-memory data store for rooms ---
// TODO: Replace with Redis for scalability
interface PlayerData {
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
  progress: number;
  ready: boolean;
  connected: boolean;
  finished: boolean;
  finishTime?: number | null; // Store finish timestamp (milliseconds)
  vote?: string | null;
  wantsPlayAgain?: boolean; // Add this flag
}

interface RoomData {
  id: string;
  name: string;
  status: "waiting" | "voting" | "countdown" | "racing" | "finished";
  createdAt: number; // Timestamp in milliseconds
  timeLimit: number;
  textLength: number; // Target word count (approx)
  playerLimit: number;
  isRanked: boolean;
  players: { [playerId: string]: PlayerData };
  text: string;
  textSource: "random" | "topic" | "custom";
  topic?: string | null;
  hostId: string;
  countdownStartedAt?: number | null;
  votingEndTime?: number | null; // Timestamp for voting end
  topicOptions?: string[];
  startTime?: number | null; // Race start timestamp (milliseconds)
  winner?: string | null; // Player ID of the winner
  // Add timers if needed (NodeJS.Timeout)
  countdownTimer?: NodeJS.Timeout | null;
  votingTimer?: NodeJS.Timeout | null;
}

const rooms: { [roomId: string]: RoomData } = {};

// CORS and body parsing first
app.use(cors());
app.use(express.json());

// Logging middleware after body parsing
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next();
});

// Error logging middleware
app.use((error, req, res, next) => {
  console.error("[Error]:", error);
  // Send JSON error response for API routes
  if (req.path.startsWith("/api/")) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } else {
    // Handle other errors if necessary, or just pass along
    next(error);
  }
});

// use OpenAI to generate a sentence based on topic

const zod = require("zod");

const text_request_schema = zod.object({
  topic: zod.string(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/openai", async (req, res, next) => {
  try {
    const { topic } = text_request_schema.parse(req.body); // zod parse to validate request body follows schema

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Generate a 30 word sentence based on the topic: ${topic}.`,
        },
      ],
    });
    res.json(response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error);
    next(error);
    res.status(500).json({ error: error.message });
  }
});

// --- Helper Functions (Placeholder) ---
const broadcastRoomUpdate = (roomId: string) => {
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

const generateRandomText = (length: number): string => {
  // Simple placeholder - replace with a better implementation if needed
  const words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "pack", "my", "box", "with", "five", "dozen", "liquor", "jugs", "how", "vexingly", "daft", "zebras", "jump"];
  let result = "";
  for (let i = 0; i < length; i++) {
    result += words[Math.floor(Math.random() * words.length)] + " ";
  }
  return result.trim() + ".";
};

const generateTextByTopic = async (topic: string, length: number): Promise<string> => {
  try {
    console.log(`Generating text for topic: ${topic}, length: ${length}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Or your preferred model
      messages: [
        { role: "system", content: "You generate text passages for a typing race game. The text should be suitable for typing practice. Avoid overly complex punctuation or formatting." },
        {
          role: "user",
          content: `Generate a text passage of approximately ${length} words based on the topic: ${topic}. Ensure it's a single block of text.`,
        },
      ],
      max_tokens: length * 3, // Estimate tokens needed
    });
    const content = response.choices[0]?.message?.content;
    console.log(`Generated content (first 50 chars): ${content?.substring(0, 50)}...`);
    return content || generateRandomText(length); // Fallback
  } catch (error) {
    console.error("Error generating text via OpenAI:", error);
    return generateRandomText(length); // Fallback on error
  }
};

const COUNTDOWN_DURATION_MS = 3000;
const VOTING_DURATION_MS = 15000; // 15 seconds for voting
const AVAILABLE_TOPICS = [
    "programming",
    "science",
    "history",
    "movies",
    "books",
    "space",
    "nature",
    "technology",
];

// Forward declaration for mutual dependency
// declare let startCountdown: (roomId: string) => void; // No longer needed if declared before use

// Handle end of voting period
const handleVotingEnd = async (roomId: string) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'voting') {
        console.log(`[Vote End] Cannot end voting for room ${roomId}. Status: ${room.status}`);
        return;
    }

    console.log(`[Vote End] Ending voting for room ${roomId}.`);

    // Clear the timer handle
    if (room.votingTimer) clearTimeout(room.votingTimer);
    room.votingTimer = undefined;

    // Tally votes
    const votes: { [topic: string]: number } = {};
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    connectedPlayers.forEach(player => {
        if (player.vote) {
            votes[player.vote] = (votes[player.vote] || 0) + 1;
        }
    });
    console.log(`[Vote End] Votes tallied for room ${roomId}:`, votes);

    // Determine winning topic
    let winningTopic = "random"; // Default to random
    let maxVotes = 0;
    const potentialWinners: string[] = [];
    const options = room.topicOptions || AVAILABLE_TOPICS;

    for (const [topic, count] of Object.entries(votes)) {
        if (count > maxVotes) {
            maxVotes = count;
            potentialWinners.length = 0; // Clear previous winners
            potentialWinners.push(topic);
        } else if (count === maxVotes) {
            potentialWinners.push(topic);
        }
    }

    if (potentialWinners.length === 1) {
        winningTopic = potentialWinners[0];
    } else if (potentialWinners.length > 1) {
        // Tie-breaker: random choice among tied winners
        console.log(`[Vote End] Tie detected in room ${roomId}. Choosing randomly from:`, potentialWinners);
        winningTopic = potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
    } else {
        // No votes or no options? Pick random from available options
        console.log(`[Vote End] No votes cast in room ${roomId}. Choosing random topic.`);
        winningTopic = options[Math.floor(Math.random() * options.length)] || "programming"; // Fallback topic
    }
    console.log(`[Vote End] Winning topic for room ${roomId}: ${winningTopic}`);

    // Generate text for the winning topic
    try {
         // Use room.textLength, fallback to a default if not set
        const textLength = room.textLength || 50; 
        room.text = await generateTextByTopic(winningTopic, textLength);
        room.topic = winningTopic; // Store the chosen topic
        room.textSource = 'topic'; // Update source
        console.log(`[Vote End] New text generated for room ${roomId}.`);

        // Transition to countdown
        startCountdown(roomId); // Start the next race countdown

    } catch (error) {
         console.error(`[Vote End] Failed to generate text or start countdown for room ${roomId}:`, error);
         // Handle error - maybe return to waiting? For now, log and proceed with default text?
         room.text = generateRandomText(room.textLength || 50);
         room.topic = "random"; // Fallback topic
         room.textSource = 'random';
         startCountdown(roomId);
    }
};

// Start the voting phase
const startTopicVoting = (roomId: string) => {
    const room = rooms[roomId];
    if (!room || (room.status !== 'finished' && room.status !== 'waiting')) { // Allow starting vote from waiting too if needed
        console.log(`[Vote Start] Cannot start voting for room ${roomId}. Status: ${room.status}`);
        return;
    }

     // Clear any existing timers
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    if (room.votingTimer) clearTimeout(room.votingTimer);
    room.countdownTimer = undefined;
    room.votingTimer = undefined;

    console.log(`[Vote Start] Starting topic voting for room ${roomId}`);
    room.status = 'voting';

    // Select topic options (e.g., 3 random unique topics)
    const shuffledTopics = [...AVAILABLE_TOPICS].sort(() => 0.5 - Math.random());
    room.topicOptions = shuffledTopics.slice(0, 3);

    room.votingEndTime = Date.now() + VOTING_DURATION_MS;

    // Reset player states for voting/next game
    Object.values(room.players).forEach(p => {
        p.progress = 0;
        p.wpm = 0;
        p.accuracy = 100;
        p.finished = false;
        p.finishTime = undefined;
        p.ready = false;
        p.vote = undefined;
        p.wantsPlayAgain = false; // Reset this flag
    });

    // Broadcast the voting start
    broadcastRoomUpdate(roomId);

    // Schedule the end of voting
    room.votingTimer = setTimeout(() => { handleVotingEnd(roomId); }, VOTING_DURATION_MS);
};

// Start the countdown phase
const startCountdown = (roomId: string) => { // Define before potential use in handleVotingEnd
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

const resetRoomForNewGame = (roomId: string) => {
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

// --- API Endpoints ---

// Schema for creating a room
const createRoomSchema = zod.object({
  username: zod.string().min(1),
  userId: zod.string().min(1),
  timeLimit: zod.number().int().min(15).max(180),
  textLength: zod.number().int().min(10).max(200), // Assuming word count
  playerLimit: zod.number().int().min(2).max(10),
  isRanked: zod.boolean(),
  textSource: zod.enum(["random", "topic", "custom"]),
  selectedTopic: zod.string().optional(), // Required if textSource is 'topic'
  customText: zod.string().optional(), // Required if textSource is 'custom'
});

app.post("/api/createRoom", async (req, res, next) => {
  try {
    const parsedBody = createRoomSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.errors });
    }

    const {
      username,
      userId,
      timeLimit,
      textLength,
      playerLimit,
      isRanked,
      textSource,
      selectedTopic,
      customText,
    } = parsedBody.data;

    // Validate topic/custom text based on source
    if (textSource === "topic" && !selectedTopic) {
      return res.status(400).json({ error: "Topic is required when textSource is 'topic'" });
    }
    if (textSource === "custom" && (!customText || customText.trim().length < 10)) {
      return res.status(400).json({ error: "Custom text must be at least 10 characters when textSource is 'custom'" });
    }

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log(`[API] Attempting to create room ${roomId}`);

    // Generate text
    let gameText = "";
    if (textSource === "topic") {
        gameText = await generateTextByTopic(selectedTopic!, textLength); // Non-null assertion validated above
    } else if (textSource === "random") {
        gameText = generateRandomText(textLength); // Use local generation for random
    } else {
        gameText = customText!.trim(); // Non-null assertion validated above
    }

    const newRoom: RoomData = {
      id: roomId,
      name: `${username}'s Race`,
      status: "waiting",
      createdAt: Date.now(),
      timeLimit,
      textLength, // Store the requested length/word count
      playerLimit,
      isRanked,
      players: {
        [userId]: {
          id: userId,
          name: username,
          wpm: 0,
          accuracy: 100,
          progress: 0,
          ready: false, // Host starts as not ready
          connected: false, // Will be set to true when they connect via socket
          finished: false,
        },
      },
      text: gameText,
      textSource,
      topic: textSource === "topic" ? selectedTopic : null,
      hostId: userId,
    };

    rooms[roomId] = newRoom;
    console.log(`[API] Room ${roomId} created successfully.`);
    res.status(201).json({ roomId });

  } catch (error) {
    console.error("[API /api/createRoom] Error:", error);
    next(error); // Pass to error handling middleware
  }
});

// Schema for checking a room
const checkRoomParamsSchema = zod.object({
  roomId: zod.string().length(6),
});

app.get("/api/checkRoom/:roomId", (req, res) => {
  const parsedParams = checkRoomParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
      return res.status(400).json({ error: "Invalid Room ID format" });
  }

  const { roomId } = parsedParams.data;
  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  // Check if joinable
  if (room.status !== "waiting") {
      return res.status(403).json({ error: "Game has already started" });
  }
  if (Object.keys(room.players).length >= room.playerLimit) {
    return res.status(403).json({ error: "Room is full" });
  }

  // Room exists and is joinable
  res.status(200).json({ message: "Room available" });
});

// --- OpenAI Endpoint (kept for now, might be refactored or removed if not needed) ---
const textRequestSchema = zod.object({
    topic: zod.string(),
    length: zod.number().int().min(10).max(200).default(30), // Add length param
});

// Note: This endpoint might become redundant if text generation is handled
// solely during room creation or voting.
app.post("/api/openai", async (req, res, next) => {
    try {
        const parsedBody = textRequestSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return res.status(400).json({ error: "Invalid request body", details: parsedBody.error.errors });
        }
        const { topic, length } = parsedBody.data;

        // Re-use the helper function
        const generatedText = await generateTextByTopic(topic, length);
        res.json({ text: generatedText }); // Send as object

    } catch (error) {
        console.error("Error in /api/openai:", error);
        next(error); // Pass to error handling middleware
    }
});

// --- Matchmaking Queue (Redis Key) ---
const MATCHMAKING_QUEUE_KEY = "matchmakingQueue";

// --- Matchmaking Player Data ---
interface MatchmakingPlayerData {
  userId: string;
  username: string;
  elo: number;
  socketId: string; // Store socket ID to communicate directly
  timestamp: number; // Time they entered the queue
}

// --- NEW: Core Matchmaking Logic ---
const ELO_RANGE = 100; // Example: Match players within 100 ELO points
const MAX_WAIT_TIME_SECONDS = 60; // Max time a player waits before widening search (optional)

const tryMatchmaking = async (playerData: MatchmakingPlayerData) => {
    console.log(`[Matchmaking] Attempting to find match for ${playerData.username} (ELO: ${playerData.elo})`);
    if (!redisClient.isReady) {
        console.error("[Matchmaking] Redis client not ready.");
        return; // Cannot proceed without Redis
    }

    const { userId, username, elo, socketId } = playerData;

    // Define the ELO search range
    const minElo = elo - ELO_RANGE;
    const maxElo = elo + ELO_RANGE;

    try {
        // <<< START TEMPORARY DEBUG >>>
        try {
            const allMembers = await redisClient.zRangeWithScores(MATCHMAKING_QUEUE_KEY, 0, -1); // Get all members
            console.log(`[Matchmaking Debug] Current full queue before range search (${allMembers.length} members):`, JSON.stringify(allMembers));
        } catch(debugError) {
            console.error("[Matchmaking Debug] Error fetching full queue:", debugError);
        }
        // <<< END TEMPORARY DEBUG >>>

        // 1. Find potential opponents in the queue within the ELO range
        console.log(`[Matchmaking Debug] Querying Redis for range using zRangeByScoreWithScores: Key=${MATCHMAKING_QUEUE_KEY}, MinSCORE=${minElo}, MaxSCORE=${maxElo}`);
        // --- Use zRangeByScoreWithScores --- 
        const potentialOpponents = await redisClient.zRangeByScoreWithScores(
            MATCHMAKING_QUEUE_KEY, 
            minElo, 
            maxElo
        );

        // Result is already [{ value: string, score: number }, ...]

        console.log(`[Matchmaking] Found ${potentialOpponents.length} potential opponents for ${username} in range [${minElo}-${maxElo}]. Raw result: ${JSON.stringify(potentialOpponents)}`); // Log raw result too

        let opponentData: MatchmakingPlayerData | null = null;
        let opponentQueueEntry: string | null = null; // Store the raw string from Redis

        // 2. Iterate through potential opponents (excluding self)
        for (const opponent of potentialOpponents) {
            // opponent.value is the stringified MatchmakingPlayerData
            // opponent.score is the ELO
            const parsedOpponent = JSON.parse(opponent.value) as MatchmakingPlayerData;

            // Don't match with self
            if (parsedOpponent.userId === userId) {
                continue;
            }

            // Basic check: ensure opponent is still connected (can be improved)
            // This relies on the disconnect handler cleaning up the queue promptly.
            // A more robust check might involve pinging the opponent's socketId.
            const opponentSocket = io.sockets.sockets.get(parsedOpponent.socketId);
            if (!opponentSocket) {
                console.warn(`[Matchmaking] Found potential opponent ${parsedOpponent.username} (${parsedOpponent.userId}) but their socket ${parsedOpponent.socketId} is disconnected. Removing from queue.`);
                // Clean up stale entry
                await redisClient.zRem(MATCHMAKING_QUEUE_KEY, opponent.value);
                continue;
            }


            console.log(`[Matchmaking] Found suitable opponent: ${parsedOpponent.username} (ELO: ${opponent.score}) for ${username}`);
            opponentData = parsedOpponent;
            opponentQueueEntry = opponent.value;
            break; // Found a match, stop searching
        }

        // 3. If an opponent was found
        if (opponentData && opponentQueueEntry) {
            console.log(`[Matchmaking] Match found: ${username} vs ${opponentData.username}`);

            // 4. Remove both players from the queue atomically (optional, but safer)
            //    Using ZREM for simplicity here. A transaction (MULTI/EXEC) could be used.
            const playerQueueEntry = JSON.stringify(playerData); // Get the string representation of the current player
            const removedCount = await redisClient.zRem(MATCHMAKING_QUEUE_KEY, [playerQueueEntry, opponentQueueEntry]);

            if (removedCount < 2) {
                 // This could happen if the opponent disconnected *just* before ZREM
                 console.warn(`[Matchmaking] Failed to remove both players from queue (removed ${removedCount}). One might have disconnected or been matched already. Aborting match.`);
                 // If we removed the current player but not the opponent, add opponent back? Complex recovery.
                 // For now, just abort. The other player might find another match later.
                 return;
            }
             console.log(`[Matchmaking] Removed ${username} and ${opponentData.username} from queue.`);

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
                        wpm: 0, accuracy: 100, progress: 0, ready: true, // Auto-ready for ranked
                        connected: true,
                        finished: false,
                    },
                    [opponentData.userId]: {
                        id: opponentData.userId,
                        name: opponentData.username,
                        wpm: 0, accuracy: 100, progress: 0, ready: true, // Auto-ready for ranked
                        connected: true,
                        finished: false,
                    },
                },
                text: roomText,
                textSource: "random",
                topic: null,
                hostId: userId, // Assign host arbitrarily
                countdownStartedAt: Date.now(), // Set countdown start time immediately
                // Timers will be set by startCountdown
            };

            rooms[roomId] = newRoom;
            console.log(`[Matchmaking] Room ${roomId} created with status 'countdown'.`);

            // 6. Notify both players about the match found
            // It's crucial to emit to the specific socket IDs stored in Redis
            io.to(socketId).emit("matchFound", { roomId });
            io.to(opponentData.socketId).emit("matchFound", { roomId });
            console.log(`[Matchmaking] Sent 'matchFound' to ${username} (${socketId}) and ${opponentData.username} (${opponentData.socketId}) for room ${roomId}`);

            // 7. Add players to the Socket.IO room and trigger countdown timer setup
            // Get the socket instances
            const playerSocket = io.sockets.sockets.get(socketId);
            const opponentSocket = io.sockets.sockets.get(opponentData.socketId);

            if (playerSocket) {
                playerSocket.join(roomId);
                 // Store room/user info on socket for consistency with joinRoom
                (playerSocket as any).userId = userId;
                (playerSocket as any).roomId = roomId;
                 console.log(`[Matchmaking] Added ${username} (${socketId}) to socket room ${roomId}`);
            } else {
                 console.warn(`[Matchmaking] Could not find socket ${socketId} for player ${username} to join room ${roomId}`);
            }
            if (opponentSocket) {
                opponentSocket.join(roomId);
                (opponentSocket as any).userId = opponentData.userId;
                (opponentSocket as any).roomId = roomId;
                 console.log(`[Matchmaking] Added ${opponentData.username} (${opponentData.socketId}) to socket room ${roomId}`);
            } else {
                 console.warn(`[Matchmaking] Could not find socket ${opponentData.socketId} for opponent ${opponentData.username} to join room ${roomId}`);
            }

            // Small delay before *scheduling the end* of countdown to allow clients to process 'matchFound'
            setTimeout(() => {
                 console.log(`[Matchmaking] Scheduling end of countdown for matched room ${roomId}`);
                 // Call startCountdown primarily to set the timeout for the transition to 'racing'
                 startCountdown(roomId); 
             }, 500); // Delay might still be useful for client sync

        } else {
            console.log(`[Matchmaking] No suitable opponent found for ${username} yet.`);
            // Player remains in the queue
        }

    } catch (error) {
        console.error("[Matchmaking] Error during matchmaking attempt:", error);
        // Consider removing the player from the queue if an error occurs?
        // Or just log and let them retry? For now, just log.
        // await redisClient.zRem(MATCHMAKING_QUEUE_KEY, JSON.stringify(playerData));
    }
};

// --- Socket.io Event Handlers ---
io.on("connection", (socket: Socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Placeholder: Handle joining a room
  socket.on("joinRoom", ({ roomId, userData }) => {
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
    broadcastRoomUpdate(roomId);
  });

  // Placeholder: Handle ready toggle
  socket.on("toggleReady", () => {
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
    broadcastRoomUpdate(roomId);

    // Check if all connected players are ready
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    // Ensure minimum players are connected AND ready
    const allReady = connectedPlayers.length >= 2 && connectedPlayers.every(p => p.ready);

    if (allReady) {
        // Call the function to handle countdown logic
        startCountdown(roomId);
    }
  });

  // Placeholder: Handle progress update
  socket.on("updateProgress", (data) => {
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
  });

  // Placeholder: Handle player finishing
  socket.on("playerFinished", (data) => {
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
     broadcastRoomUpdate(roomId);

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
         broadcastRoomUpdate(roomId);
         
         // TODO: Persist results to database? Clean up room after a delay?
     }
  });

  // Placeholder: Handle topic voting
  socket.on("submitVote", (data) => {
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
    broadcastRoomUpdate(roomId); // Broadcast the update

    // --- Check if all players have voted --- 
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    const allVoted = connectedPlayers.length > 0 && connectedPlayers.every(p => !!p.vote);

    if (allVoted) {
        console.log(`[Vote] All connected players have voted in room ${roomId}. Ending voting early.`);
        handleVotingEnd(roomId); // End voting immediately
    }
  });

  // --- NEW HANDLER: Request Play Again ---
  socket.on('requestPlayAgain', () => {
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
    broadcastRoomUpdate(roomId);

    // Check if all currently connected players want to play again
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    const allWantToPlayAgain = connectedPlayers.length > 0 && connectedPlayers.every(p => p.wantsPlayAgain);

    if (allWantToPlayAgain) {
        console.log(`[Play Again] All connected players want to play again in room ${roomId}. Starting topic voting.`);
        // --- INITIATE VOTING --- 
        startTopicVoting(roomId);
    }
  });

  // --- NEW: Handle Find Match ---
  socket.on("findMatch", async (data) => {
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
    // const queueEntry = JSON.stringify(playerData); // Don't stringify yet

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

         // Check if already in queue (e.g., duplicate request) - This check is now less critical but can stay
         // const existingScore = await redisClient.zScore(MATCHMAKING_QUEUE_KEY, queueEntry); 
         // if (existingScore !== null) { ... }

        // Add player to the sorted set (queue) with ELO as the score
        const newQueueEntry = JSON.stringify(playerData); // Stringify the latest player data
        await redisClient.zAdd(MATCHMAKING_QUEUE_KEY, {
            score: elo,
            value: newQueueEntry,
        });
         console.log(`[Socket] Added ${username} (socket: ${socket.id}) to matchmaking queue.`);
         socket.emit("searchingForMatch"); // Inform client they are now searching

        // Store userId on socket *after* successfully adding to queue
        (socket as any).userId = userId; 

        // Attempt to find a match immediately
        await tryMatchmaking(playerData);

    } catch (error) {
        console.error(`[Socket] Error during findMatch for user ${username}:`, error);
        socket.emit("matchmakingError", { message: "Failed to enter matchmaking. Please try again." });
    }
  });

  // --- NEW: Handle Cancel Matchmaking ---
  socket.on("cancelMatchmaking", async () => {
      const userId = (socket as any).userId; // Assuming userId is stored on socket after findMatch
      const socketId = socket.id;
       console.log(`[Socket] Received cancelMatchmaking from socket ${socketId}, user ID might be ${userId}`);

      if (!redisClient.isReady) {
           console.error("[Socket cancelMatchmaking] Redis client not ready.");
           // Don't necessarily need to emit error back if user explicitly cancelled
           return;
      }

       // We need to find the player's entry in the queue using their socket ID,
       // as their ELO might have changed or userId might not be set reliably yet.
       // This is less efficient than removing by exact value+score, but necessary.
      try {
          // Retrieve all entries (consider limiting if queue gets huge)
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
                     // Optionally remove malformed entry?
                     // await redisClient.zRem(MATCHMAKING_QUEUE_KEY, member);
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
           // Optionally emit an error back to the client
           // socket.emit("matchmakingError", { message: "Error cancelling matchmaking." });
      }
  });

  // Handle disconnection
  socket.on("disconnect", async (reason) => { // Make async
    console.log(`[Socket] User disconnected: ${socket.id}, reason: ${reason}`);
    const userId = (socket as any).userId;
    const roomId = (socket as any).roomId;

    // --- BEGIN Matchmaking Queue Cleanup ---
    if (redisClient.isReady) {
         console.log(`[Disconnect] Checking matchmaking queue for disconnected socket ${socket.id}`);
         // Similar logic to cancelMatchmaking: find and remove based on socket ID
         try {
             const queueMembers = await redisClient.zRange(MATCHMAKING_QUEUE_KEY, 0, -1);
             let entryToRemove: string | null = null;
             for (const member of queueMembers) {
                 try {
                     const parsedMember = JSON.parse(member) as MatchmakingPlayerData;
                     if (parsedMember.socketId === socket.id) {
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
                  console.log(`[Disconnect] Removed user (socket: ${socket.id}) from matchmaking queue.`);
             } else {
                  console.log(`[Disconnect] Disconnected user (socket: ${socket.id}) was not in the matchmaking queue.`);
             }
         } catch (error) {
              console.error(`[Disconnect] Error cleaning matchmaking queue for socket ${socket.id}:`, error);
         }
    } else {
         console.warn(`[Disconnect] Redis client not ready, cannot clean matchmaking queue for socket ${socket.id}`);
    }
    // --- END Matchmaking Queue Cleanup ---


    if (userId && roomId && rooms[roomId] && rooms[roomId].players[userId]) {
      const room = rooms[roomId];
      const player = room.players[userId];
      console.log(`[Socket] Handling disconnect for player ${player.name} (${userId}) in room ${roomId}`);

      player.connected = false;
      player.ready = false; // Player is no longer ready if they disconnect

      // Notify others in the room
      // io.to(roomId).emit("playerLeft", { userId });
      broadcastRoomUpdate(roomId); // Send full update

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
           broadcastRoomUpdate(roomId);
      }

       // 3. Clean up empty rooms (run this check LAST)
       // Check connectedPlayers again AFTER potential state changes
      const finalConnectedPlayers = Object.values(room.players).filter(p => p.connected);
       if (finalConnectedPlayers.length === 0) {
           // Check if the room was just finished
           if (room.status === 'finished') {
                console.log(`[Socket] Room ${roomId} is empty and finished. Scheduling deletion in 15 seconds.`);
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
                }, 5000); // 15 second delay (adjust as needed)
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
  });
});

const PORT = process.env.PORT || 5001;
// Start listening on the HTTP server, not the Express app directly
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// ... existing code ...
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- REMOVE THE OLD app.listen --- //
/*
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
*/
