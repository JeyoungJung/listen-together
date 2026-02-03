"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSession } from "next-auth/react";
import { Socket } from "socket.io-client";
import dynamic from "next/dynamic";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useHostSync } from "@/hooks/useHostSync";
import { useListenerSync } from "@/hooks/useListenerSync";
import { getSocket } from "@/lib/socket";
import { HostUpdate } from "@/types/spotify";
import { HUD } from "./three/HUD";
import { YouTubePlayer } from "./YouTubePlayer";

// Dynamically import the 3D Experience to avoid SSR issues
const Experience = dynamic(
  () => import("./three/Experience").then((mod) => mod.Experience),
  { ssr: false }
);

// Loading screen
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#050510] flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-pink-500 to-purple-600 animate-pulse flex items-center justify-center">
          <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <p className="text-white/50">Loading experience...</p>
      </div>
    </div>
  );
}

// Cache for prefetched Apple Music links
const appleMusicLinkCache = new Map<string, string>();

// Cache for audio features
const audioFeaturesCache = new Map<string, { tempo: number; energy: number }>();

export function ListenTogether3D() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [, setPlayerError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [appleMusicLoading, setAppleMusicLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [youtubeEnabled, setYoutubeEnabled] = useState(false);
  const lastPrefetchedTrack = useRef<string | null>(null);
  const lastFeaturesTrack = useRef<string | null>(null);
  
  // Audio features for the reactive shader
  const [audioFeatures, setAudioFeatures] = useState({ tempo: 120, energy: 0.5 });

  const isHost = session?.user?.isHost ?? false;
  const isListener = !!session && !isHost;
  const isGuestListener = isGuest && !session;

  // Ensure we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize socket connection (for all users, including guests)
  useEffect(() => {
    const socketInstance = getSocket();
    
    socketInstance.on("connect", () => {
      setSocket(socketInstance);
    });

    socketInstance.on("disconnect", () => {
      // Socket disconnected
    });

    // Listen for listener count updates
    socketInstance.on("listener_count", (data: { count: number }) => {
      setListenerCount(data.count);
    });

    // Set immediately if already connected
    if (socketInstance.connected) {
      setSocket(socketInstance);
    }

    return () => {
      socketInstance.off("listener_count");
    };
  }, []);

  // Spotify Player (for authenticated listeners only)
  const {
    deviceId,
  } = useSpotifyPlayer({
    accessToken: isListener ? session?.accessToken : undefined,
    onError: (error) => setPlayerError(error.message),
  });

  // Host sync logic
  const { currentState: hostState } = useHostSync({
    socket,
    isHost,
    pollInterval: 5000,
  });

  // Listener sync logic (works for both authenticated listeners and guests)
  const {
    hostState: listenerHostState,
    syncStatus,
    isSyncEnabled,
    setSyncEnabled,
  } = useListenerSync({
    socket,
    isListener: isListener || isGuestListener,
    deviceId,
    accessToken: session?.accessToken,
  });

  // Determine which state to display
  const displayState: HostUpdate | null = isHost ? hostState : listenerHostState;

  // Fetch audio features when track changes
  useEffect(() => {
    const trackUri = displayState?.trackUri;
    if (!trackUri || trackUri === lastFeaturesTrack.current) return;
    
    const trackId = trackUri.replace('spotify:track:', '');
    lastFeaturesTrack.current = trackUri;
    
    // Check cache first
    const cached = audioFeaturesCache.get(trackId);
    if (cached) {
      setAudioFeatures(cached);
      return;
    }
    
    // Fetch audio features
    fetch(`/api/audio-features?trackId=${trackId}`)
      .then(res => res.json())
      .then(data => {
        const features = { tempo: data.tempo || 120, energy: data.energy || 0.5 };
        audioFeaturesCache.set(trackId, features);
        setAudioFeatures(features);
      })
      .catch(() => {
        // Use defaults on error
        setAudioFeatures({ tempo: 120, energy: 0.5 });
      });
  }, [displayState?.trackUri]);

  // Prefetch Apple Music link when track changes
  useEffect(() => {
    const trackUri = displayState?.trackUri;
    if (!trackUri || trackUri === lastPrefetchedTrack.current) return;
    
    const trackId = trackUri.replace('spotify:track:', '');
    lastPrefetchedTrack.current = trackUri;
    
    // Skip if already cached
    if (appleMusicLinkCache.has(trackId)) return;
    
    // Prefetch in background
    fetch(`/api/music-link?trackId=${trackId}&platform=appleMusic`)
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          appleMusicLinkCache.set(trackId, data.url);
        }
      })
      .catch(() => {
        // Ignore prefetch errors
      });
  }, [displayState?.trackUri]);

  // Handle join as guest
  const handleJoinAsGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  // Handle open in Apple Music - uses prefetched link if available
  const handleOpenAppleMusic = useCallback(async (trackUri: string) => {
    const trackId = trackUri.replace('spotify:track:', '');
    
    // Check cache first - instant open!
    const cachedUrl = appleMusicLinkCache.get(trackId);
    if (cachedUrl) {
      window.open(cachedUrl, '_blank');
      return;
    }
    
    // Fallback to fetching if not cached
    setAppleMusicLoading(true);
    
    try {
      const response = await fetch(`/api/music-link?trackId=${trackId}&platform=appleMusic`);
      const data = await response.json();
      
      if (data.url) {
        appleMusicLinkCache.set(trackId, data.url); // Cache for future
        window.open(data.url, '_blank');
      } else {
        // Fallback to song.link if no direct link
        window.open(`https://song.link/s/${trackId}`, '_blank');
      }
    } catch {
      // Fallback to song.link on error
      window.open(`https://song.link/s/${trackId}`, '_blank');
    } finally {
      setAppleMusicLoading(false);
    }
  }, []);

  // Show loading while checking auth or not yet client-side
  if (status === "loading" || !isClient) {
    return <LoadingScreen />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#050510]">
      {/* 3D Experience */}
      <Suspense fallback={<LoadingScreen />}>
        <Experience
          albumArtUrl={displayState?.albumImageUrl || null}
          isPlaying={displayState?.isPlaying || false}
          tempo={audioFeatures.tempo}
          energy={audioFeatures.energy}
        />
      </Suspense>

      {/* HUD Overlay */}
      <HUD
        session={session}
        displayState={displayState}
        isHost={isHost}
        isGuest={isGuestListener}
        syncStatus={syncStatus}
        onJoinAsGuest={handleJoinAsGuest}
        onOpenAppleMusic={handleOpenAppleMusic}
        appleMusicLoading={appleMusicLoading}
        listenerCount={listenerCount}
        isPremiumListener={isListener && !!deviceId}
        isSyncEnabled={isSyncEnabled}
        onSyncToggle={setSyncEnabled}
      />

      {/* YouTube Player for guests */}
      {isGuestListener && displayState?.trackName && (
        <YouTubePlayer
          hostState={displayState}
          isEnabled={youtubeEnabled}
          onToggle={setYoutubeEnabled}
        />
      )}
    </div>
  );
}
