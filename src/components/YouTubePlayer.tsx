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
  const [playerKey, setPlayerKey] = useState(0); // Increment to force new player
  
  // Register setters globally for external control
  const setIsMuted = (muted: boolean) => {
    setIsMutedState(muted);
  };
  globalRefs.setIsMuted = setIsMuted;
  globalRefs.setIsPlaying = setIsPlaying;
  
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
        // loadVideoById auto-plays by default
        playerRef.current.loadVideoById(newVideoId, startSeconds);
        lastLoadedVideoRef.current = newVideoId;
        initialSyncDoneRef.current = false;
        
        // Player is already muted, so autoplay will work
        if (shouldPlay) {
          setTimeout(() => {
            try {
              playerRef.current?.playVideo();
            } catch {
              // Ignore
            }
          }, 200);
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
      }
    }

    searchVideo();
  }, [isEnabled, hostState?.trackName, hostState?.artistName, hostState?.progressMs, hostState?.isPlaying, loadVideo]);

  // Clean up when disabled and prepare for re-enable
  useEffect(() => {
    if (!isEnabled) {
      // Destroy player when disabled
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
        playerRef.current = null;
        (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef = undefined;
      }
      setIsPlayerReady(false);
      setIsPlaying(false);
      lastLoadedVideoRef.current = null;
      initialSyncDoneRef.current = false;
      // Increment key so next enable creates fresh DOM element
      setPlayerKey(k => k + 1);
    }
  }, [isEnabled]);

  // Initialize YouTube player when enabled
  useEffect(() => {
    if (!isEnabled || !containerRef.current) return;
    
    // Only create player once per enable cycle
    if (playerRef.current) return;

    const playerId = `youtube-player-${playerKey}`;

    // Wait for API to load and DOM element to exist
    const waitForAPI = setInterval(() => {
      if (window.YT && window.YT.Player && document.getElementById(playerId)) {
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
        playerRef.current = new window.YT.Player(playerId, {
          height: "100%",
          width: "100%",
          videoId: initialVideoId || undefined,
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            start: Math.floor(startSeconds),
            mute: 0, // Try unmuted first - user clicked "Join as Guest" so we have interaction
          },
          events: {
            onReady: (event) => {
              setIsPlayerReady(true);
              setIsMuted(false); // Optimistically set to unmuted
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
              
              // Check if autoplay worked after a short delay
              // If blocked, fall back to muted playback
              setTimeout(() => {
                try {
                  const state = event.target.getPlayerState();
                  if (state !== YT_PLAYING && shouldPlay) {
                    // Autoplay was blocked, mute and retry
                    event.target.mute();
                    setIsMuted(true);
                    event.target.playVideo();
                  }
                } catch {
                  // Ignore
                }
              }, 500);
              
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
  }, [isEnabled, videoId, playerKey]);

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

  // Sync playback with host - only on significant events, not every currentTime update
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !videoId || !hostState || !playerRef.current) {
      return;
    }

    // Handle play/pause state changes
    if (hostState.isPlaying && !isPlaying) {
      playerRef.current?.playVideo();
    } else if (!hostState.isPlaying && isPlaying) {
      playerRef.current?.pauseVideo();
    }

    // Do initial sync when video first loads or host state changes significantly
    if (!initialSyncDoneRef.current && hostState.isPlaying) {
      const timeSinceUpdate = hostState.timestamp ? (Date.now() - hostState.timestamp) / 1000 : 0;
      const expectedPosition = ((hostState.progressMs || 0) / 1000) + timeSinceUpdate;
      playerRef.current?.seekTo(expectedPosition, true);
      lastSyncTimeRef.current = Date.now();
      initialSyncDoneRef.current = true;
    }
  }, [isEnabled, isPlayerReady, videoId, hostState, isPlaying]);

  // Periodic drift correction - separate from play/pause logic
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !hostState?.isPlaying) {
      return;
    }

    // Check drift every 5 seconds, but only correct if really needed
    const driftCheckInterval = setInterval(() => {
      if (!playerRef.current || !hostState.isPlaying) return;
      
      try {
        const playerTime = playerRef.current.getCurrentTime();
        const timeSinceUpdate = hostState.timestamp ? (Date.now() - hostState.timestamp) / 1000 : 0;
        const expectedPosition = ((hostState.progressMs || 0) / 1000) + timeSinceUpdate;
        const drift = Math.abs(playerTime - expectedPosition);
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;

        // Only sync if drift is large AND we haven't synced recently
        if (drift > SYNC_TOLERANCE && timeSinceLastSync > SYNC_COOLDOWN) {
          playerRef.current.seekTo(expectedPosition, true);
          lastSyncTimeRef.current = now;
        }
      } catch {
        // Player might not be ready
      }
    }, 5000);

    return () => clearInterval(driftCheckInterval);
  }, [isEnabled, isPlayerReady, hostState]);

  // Simple retry logic - player is already muted so just keep trying to play
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !hostState?.isPlaying) {
      return;
    }

    // Single retry after a short delay
    const retryTimeout = setTimeout(() => {
      if (!playerRef.current) return;
      
      try {
        const playerState = playerRef.current.getPlayerState();
        if (playerState !== YT_PLAYING && hostState.isPlaying) {
          playerRef.current.playVideo();
        }
      } catch {
        // Ignore
      }
    }, 500);

    return () => clearTimeout(retryTimeout);
  }, [isEnabled, isPlayerReady, hostState?.isPlaying]);

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
      {/* Always render the iframe target - player will load video when ready */}
      <div key={playerKey} id={`youtube-player-${playerKey}`} />
    </div>
  );
}

// Global refs for external control
const globalRefs = {
  setIsMuted: null as ((muted: boolean) => void) | null,
  setIsPlaying: null as ((playing: boolean) => void) | null,
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
    play: () => {
      const player = getPlayer();
      if (!player) {
        console.log("YouTube player not ready");
        return;
      }
      
      try {
        // First attempt: try playing directly
        player.playVideo();
        
        // Check after a short delay if playback started
        setTimeout(() => {
          try {
            const state = player.getPlayerState();
            // If not playing (state 1), try muting and playing again
            if (state !== 1) {
              console.log("Playback blocked, trying muted playback");
              player.mute();
              globalRefs.setIsMuted?.(true);
              player.playVideo();
              
              // Check again
              setTimeout(() => {
                const newState = player.getPlayerState();
                if (newState === 1) {
                  globalRefs.setIsPlaying?.(true);
                }
              }, 200);
            } else {
              globalRefs.setIsPlaying?.(true);
            }
          } catch {
            // Ignore
          }
        }, 300);
      } catch (e) {
        console.error("Error playing video:", e);
      }
    },
    pause: () => {
      const player = getPlayer();
      if (!player) return;
      
      try {
        player.pauseVideo();
        globalRefs.setIsPlaying?.(false);
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
