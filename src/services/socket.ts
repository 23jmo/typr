import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "../constants/urls";

export const socket: Socket = io(BACKEND_URL, {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  secure: true
});

// Connection listeners for debugging
socket.on("connect", () => {
  console.log("[Socket] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[Socket] Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("[Socket] Connection error:", err.message);
}); 