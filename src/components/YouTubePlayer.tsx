"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { HostUpdate } from "@/types/spotify";

interface YouTubePlayerProps {
  hostState: HostUpdate | null;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

// Sync tolerance in seconds
const SYNC_TOLERANCE = 5;

export function YouTubePlayer({ hostState, isEnabled, onToggle }: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const lastSearchedTrack = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isReady,
    isPlaying,
    currentTime,
    loadVideo,
    play,
    pause,
    seekTo,
    toggleMute,
    isMuted,
  } = useYouTubePlayer({
    containerId: "youtube-player-container",
    onReady: () => {
      console.log("YouTube player ready");
    },
    onStateChange: (state) => {
      console.log("YouTube player state:", state);
    },
    onError: (error) => {
      console.error("YouTube player error:", error);
      setSearchError("Video playback error");
    },
  });

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
          
          // Load and start playing at the correct position
          if (isReady) {
            const startSeconds = (hostState!.progressMs || 0) / 1000;
            loadVideo(data.videoId, startSeconds);
          }
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
  }, [isEnabled, hostState?.trackName, hostState?.artistName, hostState?.progressMs, isReady, loadVideo]);

  // Sync playback with host
  useEffect(() => {
    if (!isEnabled || !isReady || !videoId || !hostState) {
      return;
    }

    // Sync play/pause state
    if (hostState.isPlaying && !isPlaying) {
      play();
    } else if (!hostState.isPlaying && isPlaying) {
      pause();
    }

    // Sync position (with tolerance)
    const hostPositionSec = (hostState.progressMs || 0) / 1000;
    const drift = Math.abs(currentTime - hostPositionSec);

    if (drift > SYNC_TOLERANCE && hostState.isPlaying) {
      seekTo(hostPositionSec);
      setShowSyncStatus(true);
      
      // Hide sync status after 2 seconds
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        setShowSyncStatus(false);
      }, 2000);
    }
  }, [isEnabled, isReady, videoId, hostState, isPlaying, currentTime, play, pause, seekTo]);

  // Load video when player becomes ready
  useEffect(() => {
    if (isReady && videoId && hostState) {
      const startSeconds = (hostState.progressMs || 0) / 1000;
      loadVideo(videoId, startSeconds);
      if (hostState.isPlaying) {
        // Small delay to ensure video is loaded
        setTimeout(() => play(), 500);
      }
    }
  }, [isReady, videoId, hostState, loadVideo, play]);

  const handleManualSync = useCallback(() => {
    if (hostState && isReady) {
      const hostPositionSec = (hostState.progressMs || 0) / 1000;
      seekTo(hostPositionSec);
      if (hostState.isPlaying) {
        play();
      }
      setShowSyncStatus(true);
      setTimeout(() => setShowSyncStatus(false), 2000);
    }
  }, [hostState, isReady, seekTo, play]);

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
              onClick={toggleMute}
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
        <div 
          id="youtube-player-container" 
          className="w-full h-full"
          style={{ pointerEvents: isSearching || searchError ? "none" : "auto" }}
        />
      </div>
    </motion.div>
  );
}
