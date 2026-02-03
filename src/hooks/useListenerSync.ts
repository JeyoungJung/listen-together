"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { HostUpdate } from "@/types/spotify";
import { SOCKET_EVENTS, requestSync } from "@/lib/socket";

interface UseListenerSyncOptions {
  socket: Socket | null;
  isListener: boolean;
  deviceId: string | null;
  onSync?: (update: HostUpdate) => void;
}

interface UseListenerSyncReturn {
  hostState: HostUpdate | null;
  syncStatus: "disconnected" | "syncing" | "synced" | "error";
  lastSyncTime: number | null;
  error: string | null;
  manualSync: () => void;
}

export function useListenerSync({
  socket,
  isListener,
  deviceId,
  onSync,
}: UseListenerSyncOptions): UseListenerSyncReturn {
  const [hostState, setHostState] = useState<HostUpdate | null>(null);
  const [syncStatus, setSyncStatus] = useState<"disconnected" | "syncing" | "synced" | "error">(
    "disconnected"
  );
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRequestedInitialSync = useRef(false);

  const manualSync = useCallback(() => {
    if (socket && socket.connected) {
      setSyncStatus("syncing");
      requestSync(socket);
    }
  }, [socket]);

  // Listen for host updates (works for anyone with a socket connection)
  useEffect(() => {
    if (!socket) return;

    const handleHostUpdate = (update: HostUpdate) => {
      setHostState(update);
      setSyncStatus("synced");
      setLastSyncTime(Date.now());
      setError(null);
      onSync?.(update);
    };

    socket.on(SOCKET_EVENTS.HOST_UPDATE, handleHostUpdate);
    socket.on(SOCKET_EVENTS.SYNC_RESPONSE, handleHostUpdate);

    socket.on("connect", () => {
      hasRequestedInitialSync.current = false; // Reset on reconnect
      setSyncStatus("syncing");
      requestSync(socket);
    });

    socket.on("disconnect", () => {
      setSyncStatus("disconnected");
    });

    // Request initial sync when socket is already connected
    if (socket.connected && !hasRequestedInitialSync.current) {
      hasRequestedInitialSync.current = true;
      setSyncStatus("syncing");
      requestSync(socket);
    }

    return () => {
      socket.off(SOCKET_EVENTS.HOST_UPDATE, handleHostUpdate);
      socket.off(SOCKET_EVENTS.SYNC_RESPONSE, handleHostUpdate);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [socket, onSync]);

  return {
    hostState,
    syncStatus,
    lastSyncTime,
    error,
    manualSync,
  };
}
