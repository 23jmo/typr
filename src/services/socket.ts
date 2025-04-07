import { io, Socket } from "socket.io-client";

// TODO: Replace with your actual backend server URL from environment variables
// Ensure VITE_SOCKET_URL is set in your .env file
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001"; 

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true, // Connect automatically
  transports: ['websocket'], // Explicitly use websockets if needed
});

// Optional: Connection listeners for debugging
socket.on("connect", () => {
  console.log("[Socket] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[Socket] Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("[Socket] Connection error:", err.message);
}); 