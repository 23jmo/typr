import { Server } from "socket.io";
import * as http from "http"; // Correct import for built-in module
import { createClient, RedisClientType } from "redis"; // Import Redis
import { initOpenAI } from "./topics";
import { RoomData } from "./types";
import apiRoutes, { initRoutes } from "./routes"; // Import the API routes
import { initMatchmaking } from "./matchmaking"; // Import matchmaking module
import { initRoomManager } from "./roomManager"; // Import room manager module
import { initSocketHandlers } from "./socketHandlers/index"; // Import socket handlers module
import { Request, Response, NextFunction, ErrorRequestHandler } from "express";

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
  url: `redis://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redisClient.on("error", (err) => console.error("[Redis] Client Error", err));

// Connect to Redis (handle async connection)
(async () => {
  try {
    await redisClient.connect();
    console.log("[Redis] Client Connected");
  } catch (err) {
    console.error("[Redis] Could not connect to Redis:", err);
  }
})();

// Define allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "https://typr-production.up.railway.app",
  "https://typr-frontend-production.up.railway.app",
  process.env.FRONTEND_URL,
  process.env.RAILWAY_STATIC_URL  // Add this for the frontend Railway URL
].filter((origin): origin is string => Boolean(origin));

// --- Socket.io Setup ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  path: "/socket.io/",
  transports: ["websocket", "polling"], // Allow polling as fallback
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true, // Allow Engine.IO 3 clients
});

// Add connection logging
io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  
  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// CORS configuration for Express
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next();
});

// Error logging middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
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

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "healthy" });
});

// --- API Routes ---
// Initialize the routes with the rooms reference
app.use("/api", initRoutes(rooms));

// --- Module Initialization ---
// Initialize the room manager with required dependencies
const roomManager = initRoomManager(io, rooms);

// Initialize the matchmaking module with required dependencies
const matchmaking = initMatchmaking(
  redisClient,
  rooms,
  io,
  roomManager.startCountdown
);

// Initialize and setup socket handlers with all required dependencies
const setupSocketHandlers = initSocketHandlers(
  io,
  rooms,
  roomManager,
  matchmaking
);
setupSocketHandlers();

// Add WebSocket upgrade logging
server.on("upgrade", (request, socket, head) => {
  console.log("[WebSocket] Upgrade request received", {
    url: request.url,
    headers: request.headers,
  });
});

// --- Start the server ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
