"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HostUpdate } from "@/types/spotify";

interface YouTubePlayerProps {
  hostState: HostUpdate | null;
  isEnabled: boolean;
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
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  
  // Register setters globally for external control
  globalRefs.setIsMuted = setIsMuted;
  globalRefs.setIsPlaying = setIsPlaying;
  globalRefs.setShowMiniPlayer = setShowMiniPlayer;
  
  const lastLoadedVideoRef = useRef<string | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiLoadedRef = useRef(false);
  const lastSyncTimeRef = useRef<number>(0);
  const initialSyncDoneRef = useRef(false);
  const pendingVideoRef = useRef<{ videoId: string; startSeconds: number; shouldPlay: boolean } | null>(null);

  // Helper function to safely call player methods
  function safePlayerCall(fn: () => void): void {
    try {
      fn();
    } catch {
      // Player might be destroyed or not ready
    }
  }

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
    setVideoId(newVideoId);
    
    if (playerRef.current && isPlayerReady) {
      safePlayerCall(() => {
        // If host is paused, use cueVideoById instead to avoid auto-play
        if (!shouldPlay) {
          playerRef.current!.loadVideoById(newVideoId, startSeconds);
          // Immediately pause to prevent any playback
          playerRef.current!.pauseVideo();
          setTimeout(() => safePlayerCall(() => playerRef.current?.pauseVideo()), 100);
        } else {
          playerRef.current!.loadVideoById(newVideoId, startSeconds);
          setTimeout(() => safePlayerCall(() => playerRef.current?.playVideo()), 200);
        }
        lastLoadedVideoRef.current = newVideoId;
        initialSyncDoneRef.current = false;
      });
    } else {
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
      try {
        const params = new URLSearchParams({
          track: hostState!.trackName!,
          artist: hostState!.artistName!,
        });

        const response = await fetch(`/api/youtube/search?${params}`);
        const data = await response.json();

        if (data.videoId) {
          videoIdCache.set(cacheKey, data.videoId);
          loadVideo(data.videoId, startSeconds, shouldPlay);
        } else {
          setVideoId(null);
        }
      } catch (error) {
        console.error("Error searching YouTube:", error);
      }
    }

    searchVideo();
  }, [isEnabled, hostState?.trackName, hostState?.artistName, hostState?.progressMs, hostState?.isPlaying, loadVideo]);

  // Clean up when disabled and prepare for re-enable
  useEffect(() => {
    if (!isEnabled) {
      safePlayerCall(() => {
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      });
      playerRef.current = null;
      (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef = undefined;
      setIsPlayerReady(false);
      setIsPlaying(false);
      lastLoadedVideoRef.current = null;
      initialSyncDoneRef.current = false;
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
      const shouldPlay = pending?.shouldPlay ?? hostState?.isPlaying ?? true;
      
      try {
        playerRef.current = new window.YT.Player(playerId, {
          height: "100%",
          width: "100%",
          videoId: initialVideoId || undefined,
          playerVars: {
            autoplay: shouldPlay ? 1 : 0, // Only autoplay if host is playing
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
              setIsMuted(false);
              lastLoadedVideoRef.current = initialVideoId;
              (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef = event.target;
              
              // Load pending video if different from initial
              if (pendingVideoRef.current && pendingVideoRef.current.videoId !== initialVideoId) {
                const { videoId: pendingId, startSeconds: pendingStart, shouldPlay: pendingPlay } = pendingVideoRef.current;
                event.target.loadVideoById(pendingId, pendingStart);
                lastLoadedVideoRef.current = pendingId;
                if (pendingPlay) {
                  event.target.playVideo();
                } else {
                  event.target.pauseVideo();
                }
              } else if (shouldPlay) {
                event.target.playVideo();
              } else {
                // Host is paused, ensure we're paused too
                event.target.pauseVideo();
              }
              
              // Check if autoplay worked, fall back to muted if blocked
              setTimeout(() => {
                safePlayerCall(() => {
                  const state = event.target.getPlayerState();
                  if (state !== YT_PLAYING && shouldPlay) {
                    event.target.mute();
                    setIsMuted(true);
                    event.target.playVideo();
                  }
                });
              }, 500);
              
              pendingVideoRef.current = null;
            },
            onStateChange: (event) => {
              setIsPlaying(event.data === YT_PLAYING);
            },
            onError: (event) => {
              console.error("YouTube player error:", event.data);
            },
          },
        });
      } catch (err) {
        console.error("Error creating YouTube player:", err);
      }
    }

    return () => {
      clearInterval(waitForAPI);
    };
  }, [isEnabled, videoId, playerKey]);


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

  // Periodic drift correction
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !hostState?.isPlaying) {
      return;
    }

    const driftCheckInterval = setInterval(() => {
      if (!playerRef.current || !hostState.isPlaying) return;
      
      safePlayerCall(() => {
        const playerTime = playerRef.current!.getCurrentTime();
        const timeSinceUpdate = hostState.timestamp ? (Date.now() - hostState.timestamp) / 1000 : 0;
        const expectedPosition = ((hostState.progressMs || 0) / 1000) + timeSinceUpdate;
        const drift = Math.abs(playerTime - expectedPosition);
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;

        if (drift > SYNC_TOLERANCE && timeSinceLastSync > SYNC_COOLDOWN) {
          playerRef.current!.seekTo(expectedPosition, true);
          lastSyncTimeRef.current = now;
        }
      });
    }, 5000);

    return () => clearInterval(driftCheckInterval);
  }, [isEnabled, isPlayerReady, hostState]);

  // Retry playback if it didn't start
  useEffect(() => {
    if (!isEnabled || !isPlayerReady || !hostState?.isPlaying) {
      return;
    }

    const retryTimeout = setTimeout(() => {
      safePlayerCall(() => {
        if (playerRef.current) {
          const playerState = playerRef.current.getPlayerState();
          if (playerState !== YT_PLAYING && hostState.isPlaying) {
            playerRef.current.playVideo();
          }
        }
      });
    }, 500);

    return () => clearTimeout(retryTimeout);
  }, [isEnabled, isPlayerReady, hostState?.isPlaying]);

  // Resume playback when tab becomes visible again
  useEffect(() => {
    if (!isEnabled || !isPlayerReady) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hostState?.isPlaying) {
        // Tab became visible and host is playing - resume playback
        setTimeout(() => {
          safePlayerCall(() => {
            if (playerRef.current) {
              const playerState = playerRef.current.getPlayerState();
              if (playerState !== YT_PLAYING) {
                playerRef.current.playVideo();
                
                // Also sync position since time has passed
                if (hostState.progressMs !== undefined && hostState.timestamp) {
                  const timeSinceUpdate = (Date.now() - hostState.timestamp) / 1000;
                  const expectedPosition = (hostState.progressMs / 1000) + timeSinceUpdate;
                  playerRef.current.seekTo(expectedPosition, true);
                }
              }
            }
          });
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isEnabled, isPlayerReady, hostState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safePlayerCall(() => {
        if (playerRef.current) {
          playerRef.current.destroy();
        }
      });
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

  // Mini player mode - visible in corner for PiP support
  if (showMiniPlayer) {
    return (
      <div 
        ref={containerRef}
        className="fixed bottom-24 right-4 z-50 rounded-lg overflow-hidden shadow-2xl border border-white/20 bg-black"
        style={{ width: '320px', height: '180px' }}
      >
        <div key={playerKey} id={`youtube-player-${playerKey}`} className="w-full h-full" />
        <button
          onClick={() => setShowMiniPlayer(false)}
          className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
          aria-label="Close mini player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="absolute bottom-2 left-2 text-[10px] text-white/60 bg-black/60 px-2 py-1 rounded">
          Right-click video → Picture in Picture
        </div>
      </div>
    );
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
  setShowMiniPlayer: null as ((show: boolean) => void) | null,
};

function getPlayer(): YTPlayer | null {
  return (window as unknown as { ytPlayerRef?: YTPlayer }).ytPlayerRef ?? null;
}

// Helper to safely call player methods from external controls
function safeExternalCall(fn: (player: YTPlayer) => void): void {
  const player = getPlayer();
  if (!player) return;
  
  try {
    fn(player);
  } catch {
    // Player might be destroyed or not ready
  }
}

// Export control functions for use in HUD
export function useYouTubeControls() {
  return {
    toggleMute: () => {
      safeExternalCall((player) => {
        const muted = player.isMuted();
        if (muted) {
          player.unMute();
          globalRefs.setIsMuted?.(false);
        } else {
          player.mute();
          globalRefs.setIsMuted?.(true);
        }
      });
    },
    play: () => {
      const player = getPlayer();
      if (!player) {
        console.log("YouTube player not ready");
        return;
      }
      
      safeExternalCall((player) => {
        player.playVideo();
        
        setTimeout(() => {
          safeExternalCall((player) => {
            const state = player.getPlayerState();
            if (state !== YT_PLAYING) {
              console.log("Playback blocked, trying muted playback");
              player.mute();
              globalRefs.setIsMuted?.(true);
              player.playVideo();
              
              setTimeout(() => {
                safeExternalCall((player) => {
                  if (player.getPlayerState() === YT_PLAYING) {
                    globalRefs.setIsPlaying?.(true);
                  }
                });
              }, 200);
            } else {
              globalRefs.setIsPlaying?.(true);
            }
          });
        }, 300);
      });
    },
    pause: () => {
      safeExternalCall((player) => {
        player.pauseVideo();
        globalRefs.setIsPlaying?.(false);
      });
    },
    sync: (progressMs: number, shouldPlay: boolean) => {
      safeExternalCall((player) => {
        player.seekTo(progressMs / 1000, true);
        if (shouldPlay) {
          player.playVideo();
        }
      });
    },
    showMiniPlayer: () => {
      globalRefs.setShowMiniPlayer?.(true);
    },
    hideMiniPlayer: () => {
      globalRefs.setShowMiniPlayer?.(false);
    },
  };
}
