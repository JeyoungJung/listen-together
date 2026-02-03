"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: {
            autoplay?: 0 | 1;
            controls?: 0 | 1;
            disablekb?: 0 | 1;
            fs?: 0 | 1;
            modestbranding?: 0 | 1;
            rel?: 0 | 1;
            showinfo?: 0 | 1;
            iv_load_policy?: 1 | 3;
            playsinline?: 0 | 1;
            origin?: string;
          };
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
}

interface UseYouTubePlayerOptions {
  containerId: string;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onError?: (error: number) => void;
}

interface UseYouTubePlayerReturn {
  player: YouTubePlayer | null;
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadVideo: (videoId: string, startSeconds?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  isMuted: boolean;
}

// Load YouTube IFrame API
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existingScript) {
      // Wait for it to load
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYT);
          resolve();
        }
      }, 100);
      return;
    }

    // Load the script
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });
}

export function useYouTubePlayer({
  containerId,
  onReady,
  onStateChange,
  onError,
}: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize player
  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      await loadYouTubeAPI();

      if (!mounted) return;

      // Check if container exists
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`YouTube player container #${containerId} not found`);
        return;
      }

      // Create player (player reference is set via onReady callback)
      new window.YT.Player(containerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3, // Hide annotations
          playsinline: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (event) => {
            if (!mounted) return;
            playerRef.current = event.target;
            setPlayer(event.target);
            setIsReady(true);
            setDuration(event.target.getDuration());
            onReady?.();
          },
          onStateChange: (event) => {
            if (!mounted) return;
            const state = event.data;
            setIsPlaying(state === window.YT.PlayerState.PLAYING);
            
            if (state === window.YT.PlayerState.PLAYING) {
              setDuration(event.target.getDuration());
            }
            
            onStateChange?.(state);
          },
          onError: (event) => {
            console.error("YouTube player error:", event.data);
            onError?.(event.data);
          },
        },
      });
    }

    initPlayer();

    return () => {
      mounted = false;
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
      }
    };
  }, [containerId, onReady, onStateChange, onError]);

  // Update current time periodically when playing
  useEffect(() => {
    if (isPlaying && player) {
      timeUpdateInterval.current = setInterval(() => {
        try {
          setCurrentTime(player.getCurrentTime());
        } catch {
          // Player might be destroyed
        }
      }, 1000);
    } else {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [isPlaying, player]);

  const loadVideo = useCallback((videoId: string, startSeconds?: number) => {
    if (player && isReady) {
      player.loadVideoById(videoId, startSeconds || 0);
    }
  }, [player, isReady]);

  const play = useCallback(() => {
    if (player && isReady) {
      player.playVideo();
    }
  }, [player, isReady]);

  const pause = useCallback(() => {
    if (player && isReady) {
      player.pauseVideo();
    }
  }, [player, isReady]);

  const seekTo = useCallback((seconds: number) => {
    if (player && isReady) {
      player.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  }, [player, isReady]);

  const setVolume = useCallback((volume: number) => {
    if (player && isReady) {
      player.setVolume(volume);
    }
  }, [player, isReady]);

  const toggleMute = useCallback(() => {
    if (player && isReady) {
      if (player.isMuted()) {
        player.unMute();
        setIsMuted(false);
      } else {
        player.mute();
        setIsMuted(true);
      }
    }
  }, [player, isReady]);

  return {
    player,
    isReady,
    isPlaying,
    currentTime,
    duration,
    loadVideo,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    isMuted,
  };
}
