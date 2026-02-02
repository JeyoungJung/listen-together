"use client";

import { HostUpdate } from "@/types/spotify";
import Image from "next/image";

interface PlayerProps {
  state: HostUpdate | null;
  isHost: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Player({ state, isHost }: PlayerProps) {
  if (!state || !state.trackUri) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-zinc-900/80 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-zinc-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-64 h-64 bg-zinc-800 rounded-xl flex items-center justify-center">
              <svg
                className="w-24 h-24 text-zinc-600"
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
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-lg">
                {isHost ? "Play something on Spotify" : "Waiting for host to play..."}
              </p>
              <p className="text-zinc-600 text-sm mt-2">
                {isHost
                  ? "Your playback will be shared with listeners"
                  : "You'll sync automatically when the host starts playing"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = state.durationMs > 0 ? (state.progressMs / state.durationMs) * 100 : 0;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-zinc-900/80 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-zinc-800">
        {/* Album Art */}
        <div className="relative aspect-square w-full mb-6 rounded-xl overflow-hidden shadow-lg">
          {state.albumImageUrl ? (
            <Image
              src={state.albumImageUrl}
              alt={state.albumName || "Album art"}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-24 h-24 text-zinc-600"
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
            </div>
          )}
          
          {/* Playing indicator */}
          {state.isPlaying && (
            <div className="absolute bottom-4 right-4 bg-green-500 rounded-full p-2 shadow-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="space-y-2 mb-4">
          <h2 className="text-xl font-semibold text-white truncate">
            {state.trackName}
          </h2>
          <p className="text-zinc-400 truncate">{state.artistName}</p>
          <p className="text-zinc-500 text-sm truncate">{state.albumName}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{formatTime(state.progressMs)}</span>
            <span>{formatTime(state.durationMs)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
