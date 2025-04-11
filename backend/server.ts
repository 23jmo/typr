import { Server } from "socket.io";
import * as http from 'http'; // Correct import for built-in module
import { createClient, RedisClientType } from 'redis'; // Import Redis
import { initOpenAI } from './topics';
import { RoomData } from './types';
import apiRoutes, { initRoutes } from './routes'; // Import the API routes
import { initMatchmaking } from './matchmaking'; // Import matchmaking module
import { initRoomManager } from './roomManager'; // Import room manager module
import { initSocketHandlers } from './socketHandlers/index'; // Import socket handlers module

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// --- In-memory data store for rooms ---
// TODO: Replace with Redis for scalability
const rooms: { [roomId: string]: RoomData } = {};

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

// CORS and body parsing first
app.use(cors());
app.use(express.json());

// Logging middleware
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

// Initialize OpenAI
initOpenAI(process.env.OPENAI_API_KEY!);

// --- API Routes ---
// Initialize the routes with the rooms reference
app.use('/api', initRoutes(rooms));

// --- Module Initialization ---
// Initialize the room manager with required dependencies
const roomManager = initRoomManager(io, rooms);

// Initialize the matchmaking module with required dependencies
const matchmaking = initMatchmaking(redisClient, rooms, io, roomManager.startCountdown);

// Initialize and setup socket handlers with all required dependencies
const setupSocketHandlers = initSocketHandlers(io, rooms, roomManager, matchmaking);
setupSocketHandlers();

// --- Start the server ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
