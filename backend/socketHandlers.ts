import { Server, Socket } from "socket.io";
import { RoomData } from './types';
import { initGameSocketHandlers } from './socketHandlers/gameSocketHandlers';
import { initRoomSocketHandlers } from './socketHandlers/roomSocketHandlers';
import { initMatchmakingSocketHandlers } from './socketHandlers/matchmakingSocketHandlers';

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let roomManager: any;
let matchmaking: any;

// Specialized handlers
let gameHandlers: any;
let roomHandlers: any;
let matchmakingHandlers: any;

// Initialize the module with required dependencies
export const initSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  roomManagerRef: any,
  matchmakingRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  roomManager = roomManagerRef;
  matchmaking = matchmakingRef;
  
  // Initialize specialized handlers
  gameHandlers = initGameSocketHandlers(io, rooms, roomManager);
  roomHandlers = initRoomSocketHandlers(io, rooms, roomManager);
  matchmakingHandlers = initMatchmakingSocketHandlers(io, rooms, matchmaking);
  
  console.log('[SocketHandlers] Module initialized');
  return setupSocketHandlers;
};

// Setup all socket event handlers
export const setupSocketHandlers = () => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Setup game-related socket handlers
    gameHandlers.setupGameSocketHandlers(socket);
    
    // Setup room-related socket handlers
    roomHandlers.setupRoomSocketHandlers(socket);
    
    // Setup matchmaking-related socket handlers
    matchmakingHandlers.setupMatchmakingSocketHandlers(socket);
    
    // Handle disconnect for matchmaking (needs special handling)
    socket.on("disconnect", async (reason) => {
      // First clean up matchmaking queue
      await matchmakingHandlers.handleDisconnectCleanup(socket);
      
      // Then handle room-related disconnect logic
      roomHandlers.handleDisconnect(socket)(reason);
    });
  });
}; 