import { Router } from 'express';
const zod = require("zod");
import { generateRandomText, generateTextByTopic } from './topics';
import { RoomData } from './types';

// The router will be used to define all API endpoints
const router = Router();

// Reference to the rooms object that will be passed from server.ts
let rooms: { [roomId: string]: RoomData } = {};

// Initialize the routes with the rooms reference
export const initRoutes = (roomsReference: { [roomId: string]: RoomData }) => {
  rooms = roomsReference;
  return router;
};

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

// API endpoint to create a new room
router.post("/createRoom", async (req, res, next) => {
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

// API endpoint to check if a room exists and is joinable
router.get("/checkRoom/:roomId", (req, res) => {
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

export default router; 