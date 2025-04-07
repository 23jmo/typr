import { Server, Socket } from "socket.io";
import * as http from 'http'; // Correct import for built-in module
import OpenAI from "openai";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
// Remove axios if no longer needed, OpenAI might still be used for text generation
// const axios = require("axios");

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

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
    // Check for states that should PREVENT starting a countdown
    if (room.status === 'racing' || room.status === 'finished' || room.status === 'countdown') {
        console.log(`[Countdown] Cannot start countdown for room ${roomId}. Invalid Status: ${room.status}`);
        return;
    }
    // If the code reaches here, the status must be 'waiting' or 'voting', which is valid.
    console.log(`[Countdown] Starting countdown for room ${roomId} from status: ${room.status}`); // Add more context to log

    // Clear any existing timers
    if (room.countdownTimer) {
        clearTimeout(room.countdownTimer);
    }

    console.log(`[Countdown] Starting countdown for room ${roomId}`);
    room.status = 'countdown';
    room.countdownStartedAt = Date.now();
    // Reset player ready states for the next round (optional, but good practice)
    Object.values(room.players).forEach(p => p.ready = false);

    // Broadcast the countdown start
    broadcastRoomUpdate(roomId);

    // Schedule the transition to racing
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

  // Handle disconnection
  socket.on("disconnect", (reason) => {
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
