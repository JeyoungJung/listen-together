"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HostUpdate } from "@/types/spotify";

interface YouTubePlayerProps {
  hostState: HostUpdate | null;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

// Sync tolerance in seconds
const SYNC_TOLERANCE = 5;

// YouTube Player State constants
const YT_PLAYING = 1;

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

export function YouTubePlayer({ hostState, isEnabled, onToggle }: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const lastSearchedTrack = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const apiLoadedRef = useRef(false);

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

  // Search for YouTube video when track changes
  useEffect(() => {
    if (!isEnabled || !hostState?.trackName || !hostState?.artistName) {
      return;
    }

    const trackKey = `${hostState.trackName}-${hostState.artistName}`;
    if (trackKey === lastSearchedTrack.current) {
      return;
    }

    async function searchVideo() {
      setIsSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          track: hostState!.trackName!,
          artist: hostState!.artistName!,
        });

        const response = await fetch(`/api/youtube/search?${params}`);
        const data = await response.json();

        if (data.videoId) {
          setVideoId(data.videoId);
          setVideoTitle(data.title);
          lastSearchedTrack.current = trackKey;
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
  }, [isEnabled, hostState?.trackName, hostState?.artistName]);

  // Initialize/update YouTube player when videoId changes
  useEffect(() => {
    if (!isEnabled || !videoId || !containerRef.current) return;

    // Wait for API to load
    const waitForAPI = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(waitForAPI);
        initPlayer();
      }
    }, 100);

    function initPlayer() {
      // Destroy existing player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
        playerRef.current = null;
      }

      // Create new player
      const startSeconds = hostState?.progressMs ? hostState.progressMs / 1000 : 0;
      
      try {
        playerRef.current = new window.YT.Player("youtube-player-iframe", {
          height: "100%",
          width: "100%",
          videoId: videoId || undefined,
          playerVars: {
            autoplay: hostState?.isPlaying ? 1 : 0,
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
              if (hostState?.isPlaying) {
                event.target.playVideo();
              }
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
  }, [isEnabled, videoId, hostState?.progressMs, hostState?.isPlaying]);

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

      // Sync position (with tolerance)
      const hostPositionSec = (hostState.progressMs || 0) / 1000;
      const drift = Math.abs(currentTime - hostPositionSec);

      if (drift > SYNC_TOLERANCE && hostState.isPlaying) {
        playerRef.current.seekTo(hostPositionSec, true);
        setShowSyncStatus(true);
        
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          setShowSyncStatus(false);
        }, 2000);
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
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    };
  }, []);

  const handleManualSync = useCallback(() => {
    if (hostState && playerRef.current) {
      try {
        const hostPositionSec = (hostState.progressMs || 0) / 1000;
        playerRef.current.seekTo(hostPositionSec, true);
        if (hostState.isPlaying) {
          playerRef.current.playVideo();
        }
        setShowSyncStatus(true);
        setTimeout(() => setShowSyncStatus(false), 2000);
      } catch {
        // Player might not be ready
      }
    }
  }, [hostState]);

  const handleToggleMute = useCallback(() => {
    if (playerRef.current) {
      try {
        if (playerRef.current.isMuted()) {
          playerRef.current.unMute();
          setIsMuted(false);
        } else {
          playerRef.current.mute();
          setIsMuted(true);
        }
      } catch {
        // Player might not be ready
      }
    }
  }, []);

  if (!isEnabled) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onToggle(true)}
        className="fixed bottom-28 right-4 z-20 px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 backdrop-blur-md transition-all"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <span className="text-red-300 text-sm font-medium">Listen on YouTube</span>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed z-20 transition-all duration-300 ${
        isMinimized 
          ? "bottom-28 right-4 w-80 h-48" 
          : "bottom-28 right-4 w-96 h-64"
      }`}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-md shadow-2xl">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
            <span className="text-white/80 text-xs font-medium truncate max-w-[200px]">
              {videoTitle || "YouTube Player"}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Sync button */}
            <button
              onClick={handleManualSync}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Sync with host"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {/* Mute button */}
            <button
              onClick={handleToggleMute}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            
            {/* Minimize button */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMinimized ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                )}
              </svg>
            </button>
            
            {/* Close button */}
            <button
              onClick={() => onToggle(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Close player"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sync status indicator */}
        <AnimatePresence>
          {showSyncStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-10 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 backdrop-blur-sm"
            >
              <span className="text-green-400 text-xs">Synced with host</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {isSearching && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-5">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
              <span className="text-white/60 text-sm">Finding video...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {searchError && !isSearching && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-5">
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white/60 text-sm">{searchError}</span>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${hostState?.trackName || ""} ${hostState?.artistName || ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 text-xs hover:underline"
              >
                Search manually on YouTube
              </a>
            </div>
          </div>
        )}

        {/* YouTube player container */}
        <div ref={containerRef} className="w-full h-full">
          {videoId && !searchError && (
            <div id="youtube-player-iframe" className="w-full h-full" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
