import { io, Socket } from "socket.io-client";
import { HostUpdate } from "@/types/spotify";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socketio",
      addTrailingSlash: false,
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

// Host emits playback state updates
export function emitHostUpdate(socket: Socket, update: HostUpdate): void {
  socket.emit(SOCKET_EVENTS.HOST_UPDATE, update);
}

// Listener requests current state from host
export function requestSync(socket: Socket): void {
  socket.emit(SOCKET_EVENTS.REQUEST_SYNC);
}

// Subscribe to host updates
export function onHostUpdate(
  socket: Socket,
  callback: (update: HostUpdate) => void
): void {
  socket.on(SOCKET_EVENTS.HOST_UPDATE, callback);
}

// Subscribe to sync responses
export function onSyncResponse(
  socket: Socket,
  callback: (update: HostUpdate) => void
): void {
  socket.on(SOCKET_EVENTS.SYNC_RESPONSE, callback);
}

// Clean up listeners
export function removeHostUpdateListener(
  socket: Socket,
  callback?: (update: HostUpdate) => void
): void {
  if (callback) {
    socket.off(SOCKET_EVENTS.HOST_UPDATE, callback);
  } else {
    socket.off(SOCKET_EVENTS.HOST_UPDATE);
  }
}
