"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { HostUpdate } from "@/types/spotify";
import { SOCKET_EVENTS } from "@/lib/socket";

interface CurrentlyPlayingResponse {
  playing: boolean;
  track: {
    uri: string;
    name: string;
    artists: string;
    album: string;
    albumImage: string;
    durationMs: number;
  } | null;
  progressMs: number;
  timestamp: number;
}

interface UseHostSyncOptions {
  socket: Socket | null;
  isHost: boolean;
  pollInterval?: number; // in milliseconds (default 3000)
}

interface UseHostSyncReturn {
  currentState: HostUpdate | null;
  isPolling: boolean;
  error: string | null;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useHostSync({
  socket,
  isHost,
  pollInterval = 3000,
}: UseHostSyncOptions): UseHostSyncReturn {
  const [currentState, setCurrentState] = useState<HostUpdate | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackUriRef = useRef<string | null>(null);
  const lastIsPlayingRef = useRef<boolean | null>(null);

  const fetchCurrentlyPlaying = useCallback(async () => {
    try {
      console.log("Host: Fetching current playback...");
      const response = await fetch("/api/spotify/currently-playing");
      
      if (!response.ok) {
        throw new Error("Failed to fetch playback state");
      }

      const data: CurrentlyPlayingResponse = await response.json();
      console.log("Host: Playback data:", data);

      const update: HostUpdate = {
        trackUri: data.track?.uri || null,
        trackName: data.track?.name || null,
        artistName: data.track?.artists || null,
        albumName: data.track?.album || null,
        albumImageUrl: data.track?.albumImage || null,
        isPlaying: data.playing,
        progressMs: data.progressMs || 0,
        durationMs: data.track?.durationMs || 0,
        timestamp: Date.now(),
      };

      setCurrentState(update);
      setError(null);

      // Update refs for tracking changes
      lastTrackUriRef.current = update.trackUri;
      lastIsPlayingRef.current = update.isPlaying;
      
      // Note: Server-side polling handles broadcasting to listeners
      // Host client just displays their own state

      return update;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching currently playing:", err);
      return null;
    }
  }, [socket]);

  const startPolling = useCallback(() => {
    if (!isHost || intervalRef.current) return;

    console.log("Host: Starting playback polling...");
    setIsPolling(true);
    
    // Fetch immediately
    fetchCurrentlyPlaying();

    // Then poll at interval
    intervalRef.current = setInterval(() => {
      fetchCurrentlyPlaying();
    }, pollInterval);
  }, [isHost, pollInterval, fetchCurrentlyPlaying]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Handle sync requests from listeners
  useEffect(() => {
    if (!socket || !isHost) return;

    const handleSyncRequest = () => {
      if (currentState) {
        // Update timestamp and emit fresh state
        const freshState = {
          ...currentState,
          timestamp: Date.now(),
        };
        socket.emit(SOCKET_EVENTS.SYNC_RESPONSE, freshState);
      }
    };

    socket.on(SOCKET_EVENTS.REQUEST_SYNC, handleSyncRequest);

    return () => {
      socket.off(SOCKET_EVENTS.REQUEST_SYNC, handleSyncRequest);
    };
  }, [socket, isHost, currentState]);

  // Auto-start polling when host is authenticated (socket connection optional)
  useEffect(() => {
    if (isHost) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isHost, startPolling, stopPolling]);

  return {
    currentState,
    isPolling,
    error,
    startPolling,
    stopPolling,
  };
}
