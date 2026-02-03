"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Socket } from "socket.io-client";
import { Player } from "./Player";
import { StatusIndicator } from "./StatusIndicator";
import { SyncButton } from "./SyncButton";
import { AuthButton } from "./AuthButton";
import { RoleBadge } from "./RoleBadge";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useHostSync } from "@/hooks/useHostSync";
import { useListenerSync } from "@/hooks/useListenerSync";
import { getSocket } from "@/lib/socket";
import { HostUpdate } from "@/types/spotify";

export function ListenTogether() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [appleMusicLoading, setAppleMusicLoading] = useState(false);

  const isHost = session?.user?.isHost ?? false;
  const isListener = !!session && !isHost;
  const isGuestListener = isGuest && !session;

  // Initialize socket connection (for all users, including guests)
  useEffect(() => {
    const socketInstance = getSocket();
    
    socketInstance.on("connect", () => {
      setSocket(socketInstance);
    });

    socketInstance.on("disconnect", () => {
      // Socket disconnected
    });

    // Set immediately if already connected
    if (socketInstance.connected) {
      setSocket(socketInstance);
    }

    return () => {
      // Don't disconnect on cleanup - keep socket alive
    };
  }, []);

  // Spotify Player (for authenticated listeners only)
  const {
    deviceId,
    isReady: playerReady,
  } = useSpotifyPlayer({
    accessToken: isListener ? session?.accessToken : undefined,
    onError: (error) => setPlayerError(error.message),
  });

  // Host sync logic
  const { currentState: hostState, isPolling } = useHostSync({
    socket,
    isHost,
    pollInterval: 5000,
  });

  // Listener sync logic (works for both authenticated listeners and guests)
  const {
    hostState: listenerHostState,
    syncStatus,
    error: syncError,
    manualSync,
  } = useListenerSync({
    socket,
    isListener: isListener || isGuestListener,
    deviceId,
  });

  // Determine which state to display
  const displayState: HostUpdate | null = isHost ? hostState : listenerHostState;

  // Handle manual sync for listeners
  const handleSync = useCallback(() => {
    manualSync();
  }, [manualSync]);

  // Handle join as guest
  const handleJoinAsGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  // Handle open in Apple Music
  const handleOpenAppleMusic = useCallback(async (trackUri: string) => {
    const trackId = trackUri.replace('spotify:track:', '');
    setAppleMusicLoading(true);
    
    try {
      const response = await fetch(`/api/music-link?trackId=${trackId}&platform=appleMusic`);
      const data = await response.json();
      
      if (data.url) {
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

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state - show landing page or guest view
  if ((status === "unauthenticated" || !session) && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-8 max-w-md">
          {/* Logo/Title */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="w-12 h-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <h1 className="text-4xl font-bold text-white">Listen Together</h1>
            </div>
            <p className="text-zinc-400 text-lg">
              See what the host is playing in real-time
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 text-left">
            <div className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-xl">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Real-time Updates</h3>
                <p className="text-sm text-zinc-500">
                  See what&apos;s playing as it happens
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-xl">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-purple-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Any Music Service</h3>
                <p className="text-sm text-zinc-500">
                  Open the track in Spotify, Apple Music, or any app
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Join as Guest Button */}
            <button
              onClick={handleJoinAsGuest}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-full transition-all duration-200"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>Join as Guest</span>
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-700" />
              <span className="text-zinc-500 text-sm">or</span>
              <div className="flex-1 h-px bg-zinc-700" />
            </div>

            {/* Spotify Login Button */}
            <div className="flex justify-center">
              <AuthButton session={null} />
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-zinc-600">
            Spotify login required for automatic playback sync
          </p>
        </div>
      </div>
    );
  }

  // Guest view - show player without login
  if (isGuestListener) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <span className="text-lg font-semibold text-white hidden sm:block">
                Listen Together
              </span>
            </div>
            <button
              onClick={() => setIsGuest(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-24 pb-32 px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Guest Badge & Status */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Guest
              </span>
              <StatusIndicator
                status={listenerHostState ? "synced" : syncStatus}
                isHost={false}
                error={syncError}
              />
            </div>

            {/* Player */}
            <Player state={displayState} isHost={false} isGuest={true} />

            {/* Guest Info */}
            <div className="text-center space-y-4">
              <p className="text-zinc-400">
                Find this track on your favorite music service
              </p>
              
              {/* Music Service Buttons */}
              {displayState?.trackName && displayState?.trackUri && (
                <div className="flex flex-wrap justify-center gap-3">
                  {/* Apple Music Button - fetches direct link via API */}
                  <button
                    onClick={() => handleOpenAppleMusic(displayState.trackUri!)}
                    disabled={appleMusicLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200 shadow-lg"
                  >
                    {appleMusicLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.38-.94.093-2.003 1.116-2.439.285-.12.578-.217.878-.274.374-.07.754-.112 1.13-.171.265-.042.528-.092.786-.16.304-.078.472-.282.506-.596.01-.095.015-.19.015-.285V7.087c0-.206-.038-.386-.238-.47-.116-.05-.243-.073-.37-.086-.343-.036-.687-.065-1.03-.098l-2.825-.27-1.96-.188c-.083-.008-.167-.012-.25-.023-.17-.023-.295.05-.357.2-.03.076-.043.16-.043.242v7.63c0 .32-.02.64-.11.95-.19.64-.53 1.15-1.1 1.51-.34.21-.72.33-1.11.39-.5.07-.99.07-1.48-.05-.87-.22-1.45-.8-1.65-1.67-.21-.91.17-1.89 1.05-2.35.37-.19.77-.31 1.18-.39.47-.09.94-.15 1.41-.23.27-.05.54-.1.8-.17.28-.08.47-.27.52-.56.02-.1.02-.21.02-.31V4.67c0-.19.03-.38.12-.55.12-.21.31-.32.54-.32.1 0 .2.01.3.03.46.05.93.1 1.39.15l3.4.33 2.74.26c.3.03.6.06.9.11.17.03.3.13.36.3.04.1.05.2.05.31v5.33z"/>
                      </svg>
                    )}
                    <span>{appleMusicLoading ? "Opening..." : "Open in Apple Music"}</span>
                  </button>

                  {/* Spotify Button - direct link to track */}
                  <a
                    href={`https://open.spotify.com/track/${displayState.trackUri.replace('spotify:track:', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-all duration-200 shadow-lg"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span>Open in Spotify</span>
                  </a>

                  {/* YouTube Music Button */}
                  <a
                    href={`https://music.youtube.com/search?q=${encodeURIComponent(
                      `${displayState.trackName} ${displayState.artistName}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all duration-200 shadow-lg"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
                    </svg>
                    <span>YouTube Music</span>
                  </a>

                  {/* YouTube Button */}
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${displayState.trackName} ${displayState.artistName}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>YouTube</span>
                  </a>
                </div>
              )}

              <p className="text-zinc-600 text-sm">
                Want automatic sync?{" "}
                <button
                  onClick={() => setIsGuest(false)}
                  className="text-green-500 hover:text-green-400 underline"
                >
                  Login with Spotify
                </button>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 py-4 px-4 bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-800">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-zinc-600 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <span>Listening along as guest</span>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <span className="text-lg font-semibold text-white hidden sm:block">
              Listen Together
            </span>
          </div>
          <AuthButton session={session} />
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-32 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Role Badge & Status */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <RoleBadge isHost={isHost} />
            <StatusIndicator
              status={isHost ? "broadcasting" : (listenerHostState ? "synced" : syncStatus)}
              isHost={isHost}
              error={syncError}
            />
          </div>

          {/* Player */}
          <Player state={displayState} isHost={isHost} />

          {/* Listener Controls */}
          {isListener && (
            <div className="flex flex-col items-center gap-4">
              {playerReady ? (
                <>
                  {/* Sync Button - only for Premium users */}
                  <SyncButton
                    onSync={handleSync}
                    disabled={!socket?.connected}
                    isLoading={syncStatus === "syncing"}
                  />
                  <p className="text-zinc-500 text-sm text-center">
                    Player ready! Your playback will sync with the host.
                  </p>
                </>
              ) : (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-amber-500 text-sm">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Spotify Premium required for sync</span>
                  </div>
                  <p className="text-zinc-500 text-sm">
                    You can see what the host is playing, but syncing your own playback requires Spotify Premium.
                  </p>
                  
                  {/* Show music service buttons for non-Premium users too */}
                  {displayState?.trackName && displayState?.trackUri && (
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      <button
                        onClick={() => handleOpenAppleMusic(displayState.trackUri!)}
                        disabled={appleMusicLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-400 hover:to-red-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all duration-200"
                      >
                        {appleMusicLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.38-.94.093-2.003 1.116-2.439.285-.12.578-.217.878-.274.374-.07.754-.112 1.13-.171.265-.042.528-.092.786-.16.304-.078.472-.282.506-.596.01-.095.015-.19.015-.285V7.087c0-.206-.038-.386-.238-.47-.116-.05-.243-.073-.37-.086-.343-.036-.687-.065-1.03-.098l-2.825-.27-1.96-.188c-.083-.008-.167-.012-.25-.023-.17-.023-.295.05-.357.2-.03.076-.043.16-.043.242v7.63c0 .32-.02.64-.11.95-.19.64-.53 1.15-1.1 1.51-.34.21-.72.33-1.11.39-.5.07-.99.07-1.48-.05-.87-.22-1.45-.8-1.65-1.67-.21-.91.17-1.89 1.05-2.35.37-.19.77-.31 1.18-.39.47-.09.94-.15 1.41-.23.27-.05.54-.1.8-.17.28-.08.47-.27.52-.56.02-.1.02-.21.02-.31V4.67c0-.19.03-.38.12-.55.12-.21.31-.32.54-.32.1 0 .2.01.3.03.46.05.93.1 1.39.15l3.4.33 2.74.26c.3.03.6.06.9.11.17.03.3.13.36.3.04.1.05.2.05.31v5.33z"/>
                          </svg>
                        )}
                        Apple Music
                      </button>
                      <a
                        href={`https://music.youtube.com/search?q=${encodeURIComponent(
                          `${displayState.trackName} ${displayState.artistName}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all duration-200"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
                        </svg>
                        YouTube Music
                      </a>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                          `${displayState.trackName} ${displayState.artistName}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-all duration-200"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </a>
                    </div>
                  )}
                </div>
              )}

              {playerError && (
                <p className="text-red-500 text-sm text-center">{playerError}</p>
              )}
            </div>
          )}

          {/* Host Info */}
          {isHost && (
            <div className="text-center space-y-2">
              <p className="text-zinc-400">
                {isPolling
                  ? "Broadcasting your playback to listeners..."
                  : "Start playing on Spotify to share with listeners"}
              </p>
              <p className="text-zinc-600 text-sm">
                Play music in your Spotify app and it will be synced here
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 px-4 bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-800">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-zinc-600 text-sm">
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span>Powered by Spotify</span>
        </div>
      </footer>
    </div>
  );
}
