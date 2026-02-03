"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HostUpdate } from "@/types/spotify";

interface YouTubePlayerProps {
  hostState: HostUpdate | null;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  onStatusChange?: (status: { isPlaying: boolean; isMuted: boolean }) => void;
}

// Sync tolerance in seconds
const SYNC_TOLERANCE = 10;
// Cooldown between syncs in milliseconds
const SYNC_COOLDOWN = 15000;

// YouTube Player State constants
const YT_PLAYING = 1;

// Cache for video search results - persists across component re-renders
const videoIdCache = new Map<string, string>();

// Get cache key from track info
function getCacheKey(trackName: string, artistName: string): string {
  return `${trackName.toLowerCase()}-${artistName.toLowerCase()}`;
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
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

export function YouTubePlayer({ hostState, isEnabled, onStatusChange }: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  // Register setter globally for external control
  const setIsMuted = (muted: boolean) => {
    setIsMutedState(muted);
  };
  globalRefs.setIsMuted = setIsMuted;
  
  const lastLoadedVideoRef = useRef<string | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const apiLoadedRef = useRef(false);
  const lastSyncTimeRef = useRef<number>(0);
  const initialSyncDoneRef = useRef(false);
  const pendingVideoRef = useRef<{ videoId: string; startSeconds: number; shouldPlay: boolean } | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!isEnabled || apiLoadedRef.current) return;

    const loadAPI = () => {
      if (window.YT && window.YT.Player) {
        apiLoadedRef.current = true;
        return;
      }

      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (existingScript) {
        const checkYT = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkYT);
            apiLoadedRef.current = true;
          }
        }, 100);
        return;
      }

      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      
      window.onYouTubeIframeAPIReady = () => {
        apiLoadedRef.current = true;
      };

      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    };

    loadAPI();
  }, [isEnabled]);

  // Function to load video (either via loadVideoById or initial player creation)
  const loadVideo = useCallback((newVideoId: string, startSeconds: number, shouldPlay: boolean) => {
    // Always update state so sync logic sees the change
    setVideoId(newVideoId);
    
    // If player exists and is ready, use loadVideoById for faster loading
    if (playerRef.current && isPlayerReady) {
      try {
        // loadVideoById auto-plays by default, which is what we want
        playerRef.current.loadVideoById(newVideoId, startSeconds);
        lastLoadedVideoRef.current = newVideoId;
        initialSyncDoneRef.current = false;
        
        // Ensure playback starts - call playVideo after a brief delay to let video load
        if (shouldPlay) {
          setTimeout(() => {
            try {
              playerRef.current?.playVideo();
            } catch {
              // Ignore
            }
          }, 300);
        } else {
          // Host is paused, pause after video loads
          setTimeout(() => {
            try {
              playerRef.current?.pauseVideo();
            } catch {
              // Ignore
            }
          }, 500);
        }
      } catch (err) {
        console.error("Error loading video:", err);
      }
    } else {
      // Player not ready yet, queue it up
      pendingVideoRef.current = { videoId: newVideoId, startSeconds, shouldPlay };
    }
  }, [isPlayerReady]);

  // Search for YouTube video when track changes
  useEffect(() => {
    if (!isEnabled || !hostState?.trackName || !hostState?.artistName) {
      return;
    }

    const cacheKey = getCacheKey(hostState.trackName, hostState.artistName);
    
    // Check if we already have this video loaded
    if (lastLoadedVideoRef.current && videoIdCache.get(cacheKey) === lastLoadedVideoRef.current) {
      return;
    }

    const startSeconds = (hostState.progressMs || 0) / 1000;
    const shouldPlay = hostState.isPlaying || false;

    // Check cache first - instant load!
    const cachedVideoId = videoIdCache.get(cacheKey);
    if (cachedVideoId) {
      loadVideo(cachedVideoId, startSeconds, shouldPlay);
      return;
    }

    // Not in cache, need to search
    async function searchVideo() {
      setSearchError(null);
      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          track: hostState!.trackName!,
          artist: hostState!.artistName!,
        });

        const response = await fetch(`/api/youtube/search?${params}`);
        const data = await response.json();

        if (data.videoId) {
          // Cache the result
          videoIdCache.set(cacheKey, data.videoId);
          
          // Load the video
          loadVideo(data.videoId, startSeconds, shouldPlay);
        } else {
          setSearchError(data.error || "Video not found");
          setVideoId(null);
        }
      } catch (error) {
        console.error("Error searching YouTube:", error);
        setSearchError("Failed to search YouTube");
      } finally {
        setIsSearching(false);
      }
    }

    searchVideo();
  }, [isEnabled, hostState?.trackName, hostState?.artistName, hostState?.progressMs, hostState?.isPlaying, loadVideo]);

  // Initialize YouTube player once (reuse for all videos)
  useEffect(() => {
    if (!isEnabled || !containerRef.current) return;
    
    // Only create player once
    if (playerRef.current) return;

    // Wait for API to load
    const waitForAPI = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(waitForAPI);
        initPlayer();
      }
    }, 100);

    function initPlayer() {
      const pending = pendingVideoRef.current;
      const initialVideoId = pending?.videoId || videoId;
      const startSeconds = pending?.startSeconds || 0;
      const shouldPlay = pending?.shouldPlay ?? true;
      
      try {
        playerRef.current = new window.YT.Player("youtube-player-iframe", {
          height: "100%",
          width: "100%",
          videoId: initialVideoId || undefined,
          playerVars: {
            autoplay: shouldPlay ? 1 : 0,
            controls: 1,
            disablekb: 0,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            start: Math.floor(startSeconds),
          },
          events: {
            onReady: (event) => {
              setIsPlayerReady(true);
              lastLoadedVideoRef.current = initialVideoId;
              // Store globally for external control
              (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef = event.target;
              
              // If there's a pending video that's different, load it now
              if (pendingVideoRef.current && pendingVideoRef.current.videoId !== initialVideoId) {
                const { videoId: pendingId, startSeconds: pendingStart, shouldPlay: pendingPlay } = pendingVideoRef.current;
                event.target.loadVideoById(pendingId, pendingStart);
                lastLoadedVideoRef.current = pendingId;
                if (pendingPlay) {
                  event.target.playVideo();
                }
              } else if (shouldPlay) {
                event.target.playVideo();
              }
              
              pendingVideoRef.current = null;
            },
            onStateChange: (event) => {
              setIsPlaying(event.data === YT_PLAYING);
            },
            onError: (event) => {
              console.error("YouTube player error:", event.data);
              setSearchError("Video playback error");
            },
          },
        });
      } catch (err) {
        console.error("Error creating YouTube player:", err);
        setSearchError("Failed to create player");
      }
    }

    return () => {
      clearInterval(waitForAPI);
    };
  }, [isEnabled, videoId]);

  // Time update interval
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      timeUpdateRef.current = setInterval(() => {
        try {
          if (playerRef.current) {
            setCurrentTime(playerRef.current.getCurrentTime());
          }
        } catch {
          // Player might be destroyed
        }
      }, 1000);
    }

    return () => {
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, [isPlaying]);

  // Sync playback with host
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !videoId || !hostState || !playerRef.current) {
      return;
    }

    try {
      // Sync play/pause state
      if (hostState.isPlaying && !isPlaying) {
        playerRef.current.playVideo();
      } else if (!hostState.isPlaying && isPlaying) {
        playerRef.current.pauseVideo();
      }

      // Calculate expected host position accounting for time elapsed since update
      const timeSinceUpdate = hostState.timestamp ? (Date.now() - hostState.timestamp) / 1000 : 0;
      const expectedHostPosition = ((hostState.progressMs || 0) / 1000) + (hostState.isPlaying ? timeSinceUpdate : 0);
      const drift = Math.abs(currentTime - expectedHostPosition);
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;

      // Only sync if:
      // 1. Initial sync hasn't been done yet, OR
      // 2. Drift is significant AND cooldown has passed
      const shouldSync = !initialSyncDoneRef.current || 
        (drift > SYNC_TOLERANCE && timeSinceLastSync > SYNC_COOLDOWN && hostState.isPlaying);

      if (shouldSync && hostState.isPlaying) {
        playerRef.current.seekTo(expectedHostPosition, true);
        lastSyncTimeRef.current = now;
        initialSyncDoneRef.current = true;
      }
    } catch {
      // Player might not be ready
    }
  }, [isEnabled, isPlayerReady, videoId, hostState, isPlaying, currentTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
      }
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, []);

  // Report status changes to parent
  useEffect(() => {
    onStatusChange?.({ isPlaying, isMuted });
  }, [isPlaying, isMuted, onStatusChange]);

  // Don't render anything if not enabled
  if (!isEnabled) {
    return null;
  }

  // Hidden YouTube player - audio only, no visual UI
  // Controls are shown in the HUD via onStatusChange callback
  return (
    <div 
      ref={containerRef} 
      className="fixed -top-[1000px] -left-[1000px] w-1 h-1 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {videoId && !searchError && (
        <div id="youtube-player-iframe" />
      )}
    </div>
  );
}

// Global refs for external control
const globalRefs = {
  setIsMuted: null as ((muted: boolean) => void) | null,
};

function getPlayer(): YTPlayer | null {
  return (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef ?? null;
}

// Export control functions for use in HUD
export function useYouTubeControls() {
  return {
    toggleMute: () => {
      const player = getPlayer();
      if (!player) return;
      
      try {
        const isMuted = player.isMuted();
        if (isMuted) {
          player.unMute();
          globalRefs.setIsMuted?.(false);
        } else {
          player.mute();
          globalRefs.setIsMuted?.(true);
        }
      } catch {
        // Ignore
      }
    },
    sync: (progressMs: number, shouldPlay: boolean) => {
      const player = getPlayer();
      if (!player) return;
      
      try {
        player.seekTo(progressMs / 1000, true);
        if (shouldPlay) {
          player.playVideo();
        }
      } catch {
        // Ignore
      }
    },
  };
}
