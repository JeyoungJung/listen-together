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
import { getSocket, disconnectSocket } from "@/lib/socket";
import { HostUpdate } from "@/types/spotify";

export function ListenTogether() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const isHost = session?.user?.isHost ?? false;
  const isListener = !!session && !isHost;

  // Initialize socket connection
  useEffect(() => {
    if (status === "authenticated" && session?.accessToken) {
      const socketInstance = getSocket();
      setSocket(socketInstance);

      socketInstance.on("connect", () => {
        console.log("Socket connected");
      });

      socketInstance.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      return () => {
        disconnectSocket();
        setSocket(null);
      };
    }
  }, [status, session?.accessToken]);

  // Spotify Player (for listeners)
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

  // Listener sync logic
  const {
    hostState: listenerHostState,
    syncStatus,
    error: syncError,
    manualSync,
  } = useListenerSync({
    socket,
    isListener,
    deviceId,
  });

  // Determine which state to display
  const displayState: HostUpdate | null = isHost ? hostState : listenerHostState;

  // Handle manual sync for listeners
  const handleSync = useCallback(() => {
    manualSync();
  }, [manualSync]);

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

  // Unauthenticated state
  if (status === "unauthenticated" || !session) {
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
              Sync your Spotify playback with friends in real-time
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
                <h3 className="font-medium text-white">Real-time Sync</h3>
                <p className="text-sm text-zinc-500">
                  Everyone hears the same song at the same time
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Host & Listener Roles</h3>
                <p className="text-sm text-zinc-500">
                  The host controls playback, listeners follow along
                </p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <AuthButton session={null} />

          {/* Note */}
          <p className="text-xs text-zinc-600">
            Requires Spotify Premium for playback control
          </p>
        </div>
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
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Role Badge & Status */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <RoleBadge isHost={isHost} />
            <StatusIndicator
              status={isHost ? "broadcasting" : syncStatus}
              isHost={isHost}
              error={syncError || playerError}
            />
          </div>

          {/* Player */}
          <Player state={displayState} isHost={isHost} />

          {/* Listener Controls */}
          {isListener && (
            <div className="flex flex-col items-center gap-4">
              {/* Sync Button */}
              <SyncButton
                onSync={handleSync}
                disabled={!playerReady || !socket?.connected}
                isLoading={syncStatus === "syncing"}
              />

              {/* Player Status */}
              {!playerReady && (
                <div className="flex items-center gap-2 text-amber-500 text-sm">
                  <svg
                    className="w-4 h-4 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>Initializing Spotify player...</span>
                </div>
              )}

              {playerReady && (
                <p className="text-zinc-500 text-sm text-center">
                  Player ready! Your playback will sync with the host.
                </p>
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
