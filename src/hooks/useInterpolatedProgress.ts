"use client";

import { useState, useEffect, useRef } from "react";

interface UseInterpolatedProgressOptions {
  serverProgressMs: number;
  durationMs: number;
  isPlaying: boolean;
  serverTimestamp: number;
  updateInterval?: number; // How often to update (ms), default 100ms for smooth animation
}

/**
 * Interpolates playback progress client-side for smooth UI updates.
 * Instead of jumping every 3 seconds when server polls, this hook
 * estimates the current position based on elapsed time since last update.
 */
export function useInterpolatedProgress({
  serverProgressMs,
  durationMs,
  isPlaying,
  serverTimestamp,
  updateInterval = 100,
}: UseInterpolatedProgressOptions): number {
  const [currentProgress, setCurrentProgress] = useState(serverProgressMs);
  const lastServerUpdate = useRef({ progressMs: serverProgressMs, timestamp: serverTimestamp });

  // Update when server sends new data
  useEffect(() => {
    lastServerUpdate.current = { progressMs: serverProgressMs, timestamp: serverTimestamp };
    setCurrentProgress(serverProgressMs);
  }, [serverProgressMs, serverTimestamp]);

  // Interpolate progress while playing
  useEffect(() => {
    if (!isPlaying || durationMs <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastServerUpdate.current.timestamp;
      const estimatedProgress = Math.min(
        lastServerUpdate.current.progressMs + elapsed,
        durationMs
      );
      setCurrentProgress(estimatedProgress);
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [isPlaying, durationMs, updateInterval]);

  return currentProgress;
}
