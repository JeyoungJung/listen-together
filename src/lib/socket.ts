import { io, Socket } from "socket.io-client";
import { HostUpdate } from "@/types/spotify";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socketio",
      addTrailingSlash: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Event types
export const SOCKET_EVENTS = {
  HOST_UPDATE: "host_update",
  LISTENER_CONNECTED: "listener_connected",
  LISTENER_DISCONNECTED: "listener_disconnected",
  REQUEST_SYNC: "request_sync",
  SYNC_RESPONSE: "sync_response",
} as const;

// Listener requests current state from host
export function requestSync(socket: Socket): void {
  socket.emit(SOCKET_EVENTS.REQUEST_SYNC);
}
