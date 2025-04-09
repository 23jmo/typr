import { Server, Socket } from "socket.io";
import { RoomData } from '../types';

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let matchmaking: any;

// Initialize the module with required dependencies
export const initMatchmakingSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  matchmakingRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  matchmaking = matchmakingRef;
  
  console.log('[MatchmakingSocketHandlers] Module initialized');
  return {
    setupMatchmakingSocketHandlers,
    handleDisconnectCleanup
  };
};

// Setup matchmaking-related socket event handlers
export const setupMatchmakingSocketHandlers = (socket: Socket) => {
  // Handle Find Match
  socket.on("findMatch", (data) => matchmaking.handleFindMatch(socket, data));

  // Handle Cancel Matchmaking
  socket.on("cancelMatchmaking", () => matchmaking.handleCancelMatchmaking(socket));
};

// Handle disconnect cleanup for matchmaking
export const handleDisconnectCleanup = (socket: Socket) => {
  return matchmaking.handleDisconnectCleanup(socket);
}; 