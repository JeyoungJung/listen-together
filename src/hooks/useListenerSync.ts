"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { HostUpdate } from "@/types/spotify";
import { SOCKET_EVENTS, requestSync } from "@/lib/socket";

interface UseListenerSyncOptions {
  socket: Socket | null;
  isListener: boolean;
  deviceId: string | null;
  accessToken?: string;
  onSync?: (update: HostUpdate) => void;
}

interface UseListenerSyncReturn {
  hostState: HostUpdate | null;
  syncStatus: "disconnected" | "syncing" | "synced" | "error";
  lastSyncTime: number | null;
  error: string | null;
  manualSync: () => void;
  isSyncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
}

// Tolerance for position sync (5 seconds)
const SYNC_TOLERANCE_MS = 5000;

export function useListenerSync({
  socket,
  isListener,
  deviceId,
  accessToken,
  onSync,
}: UseListenerSyncOptions): UseListenerSyncReturn {
  const [hostState, setHostState] = useState<HostUpdate | null>(null);
  const [syncStatus, setSyncStatus] = useState<"disconnected" | "syncing" | "synced" | "error">(
    "disconnected"
  );
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncEnabled, setSyncEnabled] = useState(true);
  const hasRequestedInitialSync = useRef(false);
  const lastSyncedTrack = useRef<string | null>(null);
  const lastSyncedPosition = useRef<number>(0);

  // Function to sync playback with host
  const syncPlayback = useCallback(async (update: HostUpdate) => {
    // Only sync if we have all required pieces and sync is enabled
    if (!isListener || !deviceId || !accessToken || !isSyncEnabled) {
      return;
    }

    try {
      const trackChanged = lastSyncedTrack.current !== update.trackUri;
      const positionDrift = Math.abs((update.progressMs || 0) - lastSyncedPosition.current);
      const needsPositionSync = positionDrift > SYNC_TOLERANCE_MS;

      // Handle pause state
      if (!update.isPlaying) {
        await fetch("/api/spotify/play", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "pause",
            deviceId: deviceId,
          }),
        });
        lastSyncedTrack.current = update.trackUri;
        return;
      }

      // Handle play state - sync if track changed or position drifted
      if (update.isPlaying && update.trackUri && (trackChanged || needsPositionSync)) {
        const response = await fetch("/api/spotify/play", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackUri: update.trackUri,
            positionMs: update.progressMs || 0,
            deviceId: deviceId,
          }),
        });

        if (response.ok) {
          lastSyncedTrack.current = update.trackUri;
          lastSyncedPosition.current = update.progressMs || 0;
          setSyncStatus("synced");
        } else {
          const data = await response.json();
          setError(data.error || "Failed to sync playback");
          setSyncStatus("error");
        }
      }
    } catch (err) {
      console.error("Error syncing playback:", err);
      setError("Failed to sync playback");
      setSyncStatus("error");
    }
  }, [isListener, deviceId, accessToken, isSyncEnabled]);

  const manualSync = useCallback(() => {
    if (socket && socket.connected) {
      setSyncStatus("syncing");
      // Reset sync state to force re-sync
      lastSyncedTrack.current = null;
      lastSyncedPosition.current = 0;
      requestSync(socket);
    }
  }, [socket]);

  // Listen for host updates
  useEffect(() => {
    if (!socket) return;

    const handleHostUpdate = (update: HostUpdate) => {
      setHostState(update);
      setLastSyncTime(Date.now());
      setError(null);
      onSync?.(update);
      
      // Sync playback for Premium listeners
      if (isListener && deviceId && accessToken) {
        syncPlayback(update);
      } else {
        setSyncStatus("synced");
      }
    };

    socket.on(SOCKET_EVENTS.HOST_UPDATE, handleHostUpdate);
    socket.on(SOCKET_EVENTS.SYNC_RESPONSE, handleHostUpdate);

    socket.on("connect", () => {
      hasRequestedInitialSync.current = false;
      setSyncStatus("syncing");
      requestSync(socket);
    });

    socket.on("disconnect", () => {
      setSyncStatus("disconnected");
    });

    // Request initial sync
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
  }, [socket, onSync, isListener, deviceId, accessToken, syncPlayback]);

  return {
    hostState,
    syncStatus,
    lastSyncTime,
    error,
    manualSync,
    isSyncEnabled,
    setSyncEnabled,
  };
}
