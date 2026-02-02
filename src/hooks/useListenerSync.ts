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

// Threshold for position drift before forcing a sync (in milliseconds)
const SYNC_THRESHOLD_MS = 3000;

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
  const isSyncingRef = useRef(false);

  const syncToHost = useCallback(
    async (update: HostUpdate) => {
      if (!deviceId || !update.trackUri || isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      setSyncStatus("syncing");

      try {
        // Calculate the expected position based on time elapsed since the update
        const timeSinceUpdate = Date.now() - update.timestamp;
        const expectedPosition = update.isPlaying
          ? update.progressMs + timeSinceUpdate
          : update.progressMs;

        // Clamp to track duration
        const clampedPosition = Math.min(expectedPosition, update.durationMs);

        if (update.isPlaying) {
          // Play the track at the calculated position
          const response = await fetch("/api/spotify/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackUri: update.trackUri,
              positionMs: Math.max(0, clampedPosition),
              deviceId,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to sync playback");
          }
        } else {
          // If host is paused, pause the listener too
          await fetch("/api/spotify/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "pause",
              deviceId,
            }),
          });
        }

        setSyncStatus("synced");
        setLastSyncTime(Date.now());
        setError(null);
        onSync?.(update);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sync failed";
        setError(errorMessage);
        setSyncStatus("error");
        console.error("Error syncing to host:", err);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [deviceId, onSync]
  );

  const handleHostUpdate = useCallback(
    (update: HostUpdate) => {
      console.log("Received host update:", update.trackName, update.isPlaying);
      setHostState(update);

      if (!isListener || !deviceId) return;

      // Check if we need to sync (track changed, or significant position drift)
      const needsSync =
        !hostState ||
        hostState.trackUri !== update.trackUri ||
        hostState.isPlaying !== update.isPlaying;

      if (needsSync) {
        syncToHost(update);
      }
    },
    [isListener, deviceId, hostState, syncToHost]
  );

  const manualSync = useCallback(() => {
    if (socket && socket.connected) {
      setSyncStatus("syncing");
      requestSync(socket);
    }
  }, [socket]);

  // Listen for host updates
  useEffect(() => {
    if (!socket || !isListener) return;

    socket.on(SOCKET_EVENTS.HOST_UPDATE, handleHostUpdate);
    socket.on(SOCKET_EVENTS.SYNC_RESPONSE, handleHostUpdate);

    // When connected, request current state
    if (socket.connected) {
      setSyncStatus("syncing");
      requestSync(socket);
    }

    socket.on("connect", () => {
      setSyncStatus("syncing");
      requestSync(socket);
    });

    socket.on("disconnect", () => {
      setSyncStatus("disconnected");
    });

    return () => {
      socket.off(SOCKET_EVENTS.HOST_UPDATE, handleHostUpdate);
      socket.off(SOCKET_EVENTS.SYNC_RESPONSE, handleHostUpdate);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [socket, isListener, handleHostUpdate]);

  // Periodic sync check to handle drift
  useEffect(() => {
    if (!isListener || !hostState || syncStatus !== "synced") return;

    const checkDrift = setInterval(() => {
      if (hostState.isPlaying && hostState.trackUri) {
        const expectedPosition =
          hostState.progressMs + (Date.now() - hostState.timestamp);

        // If we've drifted too far, request a new sync
        if (expectedPosition - hostState.progressMs > SYNC_THRESHOLD_MS * 2) {
          console.log("Drift detected, requesting sync");
          manualSync();
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkDrift);
  }, [isListener, hostState, syncStatus, manualSync]);

  return {
    hostState,
    syncStatus,
    lastSyncTime,
    error,
    manualSync,
  };
}
