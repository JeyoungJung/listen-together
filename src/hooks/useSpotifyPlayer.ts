"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SpotifyPlayer, SpotifyPlaybackState } from "@/types/spotify";

interface UseSpotifyPlayerOptions {
  accessToken: string | undefined;
  onReady?: (deviceId: string) => void;
  onStateChange?: (state: SpotifyPlaybackState | null) => void;
  onError?: (error: Error) => void;
}

interface UseSpotifyPlayerReturn {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  isReady: boolean;
  currentState: SpotifyPlaybackState | null;
  play: (uri: string, positionMs?: number) => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

export function useSpotifyPlayer({
  accessToken,
  onReady,
  onStateChange,
  onError,
}: UseSpotifyPlayerOptions): UseSpotifyPlayerReturn {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentState, setCurrentState] = useState<SpotifyPlaybackState | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Load the Spotify SDK script
  useEffect(() => {
    if (!accessToken) return;

    const script = document.getElementById("spotify-player-script");
    if (!script) {
      const newScript = document.createElement("script");
      newScript.id = "spotify-player-script";
      newScript.src = "https://sdk.scdn.co/spotify-player.js";
      newScript.async = true;
      document.body.appendChild(newScript);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: "Listen Together",
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: 0.5,
      });

      // Error handling
      spotifyPlayer.addListener("initialization_error", (state) => {
        const { message } = state as { message: string };
        console.error("Initialization error:", message);
        onError?.(new Error(message));
      });

      spotifyPlayer.addListener("authentication_error", (state) => {
        const { message } = state as { message: string };
        console.error("Authentication error:", message);
        onError?.(new Error(message));
      });

      spotifyPlayer.addListener("account_error", (state) => {
        const { message } = state as { message: string };
        console.error("Account error:", message);
        onError?.(new Error(message));
      });

      spotifyPlayer.addListener("playback_error", (state) => {
        const { message } = state as { message: string };
        console.error("Playback error:", message);
        onError?.(new Error(message));
      });

      // Playback state changes
      spotifyPlayer.addListener("player_state_changed", (state) => {
        const playbackState = state as SpotifyPlaybackState | null;
        setCurrentState(playbackState);
        onStateChange?.(playbackState);
      });

      // Ready
      spotifyPlayer.addListener("ready", (state) => {
        const { device_id } = state as { device_id: string };
        console.log("Spotify Player ready with Device ID:", device_id);
        setDeviceId(device_id);
        setIsReady(true);
        onReady?.(device_id);
      });

      // Not Ready
      spotifyPlayer.addListener("not_ready", (state) => {
        const { device_id } = state as { device_id: string };
        console.log("Device ID has gone offline:", device_id);
        setIsReady(false);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
      playerRef.current = spotifyPlayer;
    };

    // Check if SDK is already loaded
    if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [accessToken, onReady, onStateChange, onError]);

  const play = useCallback(
    async (uri: string, positionMs: number = 0) => {
      if (!deviceId || !accessToken) {
        throw new Error("Player not ready");
      }

      await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUri: uri,
          positionMs,
          deviceId,
        }),
      });
    },
    [deviceId, accessToken]
  );

  const pause = useCallback(async () => {
    if (!player) {
      throw new Error("Player not ready");
    }
    await player.pause();
  }, [player]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (!player) {
        throw new Error("Player not ready");
      }
      await player.seek(positionMs);
    },
    [player]
  );

  const setVolume = useCallback(
    async (volume: number) => {
      if (!player) {
        throw new Error("Player not ready");
      }
      await player.setVolume(volume);
    },
    [player]
  );

  return {
    player,
    deviceId,
    isReady,
    currentState,
    play,
    pause,
    seek,
    setVolume,
  };
}
