"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn, signOut } from "next-auth/react";
import { Session } from "next-auth";
import Image from "next/image";
import { HostUpdate } from "@/types/spotify";

interface HUDProps {
  session: Session | null;
  displayState: HostUpdate | null;
  isHost: boolean;
  isGuest: boolean;
  syncStatus: string;
  onJoinAsGuest: () => void;
  onOpenAppleMusic: (trackUri: string) => void;
  appleMusicLoading: boolean;
  listenerCount: number;
  isSyncEnabled?: boolean;
  onSyncToggle?: (enabled: boolean) => void;
  isPremiumListener?: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Glassmorphism card component
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`
        backdrop-blur-xl bg-white/5 
        border border-white/10 
        rounded-2xl shadow-2xl
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

// Landing screen for unauthenticated users
function LandingHUD({ onJoinAsGuest }: { onJoinAsGuest: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-10 p-4">
      <GlassCard className="max-w-md w-full p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center space-y-6"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </motion.div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Listen Together</h1>
          </div>

          <p className="text-white/60 text-lg">
            Experience music together in real-time
          </p>

          {/* Action buttons */}
          <div className="space-y-4 pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onJoinAsGuest}
              className="w-full py-4 px-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium transition-all duration-300 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Join as Guest
            </motion.button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-sm">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signIn("spotify")}
              className="w-full py-4 px-6 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-white font-medium transition-all duration-300 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Login with Spotify
            </motion.button>
          </div>

          <p className="text-white/30 text-xs pt-4">
            Spotify Premium required for playback sync
          </p>
        </motion.div>
      </GlassCard>
    </div>
  );
}

// Now Playing info bar
function NowPlayingBar({
  displayState,
  isHost,
  isGuest,
  syncStatus,
  onOpenAppleMusic,
  appleMusicLoading,
  isPremiumListener,
  isSyncEnabled,
  onSyncToggle,
}: {
  displayState: HostUpdate | null;
  isHost: boolean;
  isGuest: boolean;
  syncStatus: string;
  onOpenAppleMusic: (trackUri: string) => void;
  appleMusicLoading: boolean;
  isPremiumListener?: boolean;
  isSyncEnabled?: boolean;
  onSyncToggle?: (enabled: boolean) => void;
}) {
  const [showProgress] = useState(true);

  if (!displayState?.trackName) {
    return (
      <GlassCard className="p-6 text-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white/50"
        >
          <p className="text-lg">Waiting for music...</p>
          <p className="text-sm mt-2">
            {isHost ? "Play something on Spotify" : "Host will start playing soon"}
          </p>
        </motion.div>
      </GlassCard>
    );
  }

  const progressPercent = displayState.durationMs > 0 
    ? (displayState.progressMs / displayState.durationMs) * 100 
    : 0;

  return (
    <GlassCard className="p-6">
      <div className="space-y-4">
        {/* Track info */}
        <div className="flex items-start gap-4">
          {displayState.albumImageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-16 h-16 rounded-lg overflow-hidden shadow-lg flex-shrink-0"
            >
              <Image
                src={displayState.albumImageUrl}
                alt={displayState.albumName || "Album"}
                fill
                className="object-cover"
              />
            </motion.div>
          )}
          <div className="flex-1 min-w-0">
            <motion.h2
              key={displayState.trackName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-white font-semibold text-lg truncate"
            >
              {displayState.trackName}
            </motion.h2>
            <p className="text-white/60 truncate">{displayState.artistName}</p>
            <p className="text-white/40 text-sm truncate">{displayState.albumName}</p>
          </div>
          
          {/* Playing indicator */}
          <div className="flex items-center gap-2">
            {displayState.isPlaying ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex items-center gap-1"
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ["8px", "16px", "8px"] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                    className="w-1 bg-green-400 rounded-full"
                  />
                ))}
              </motion.div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <div className="w-2 h-2 bg-white/40 rounded-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="space-y-2">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>{formatTime(displayState.progressMs)}</span>
              <span>{formatTime(displayState.durationMs)}</span>
            </div>
          </div>
        )}

        {/* Status and actions */}
        <div className="flex items-center justify-between pt-2">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === "synced" || displayState.isPlaying 
                ? "bg-green-400" 
                : "bg-yellow-400"
            } animate-pulse`} />
            <span className="text-white/50 text-sm">
              {isHost ? "Broadcasting" : isGuest ? "Viewing as guest" : isPremiumListener && isSyncEnabled ? "Listening along" : "Synced"}
            </span>
            
            {/* Sync toggle for Premium listeners */}
            {isPremiumListener && onSyncToggle && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSyncToggle(!isSyncEnabled)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  isSyncEnabled 
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                    : "bg-white/10 text-white/50 border border-white/20"
                }`}
                title={isSyncEnabled ? "Click to stop syncing playback" : "Click to sync playback with host"}
              >
                {isSyncEnabled ? "Sync On" : "Sync Off"}
              </motion.button>
            )}
          </div>

          {/* Music service buttons for guests */}
          {(isGuest || !isHost) && displayState.trackUri && (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onOpenAppleMusic(displayState.trackUri!)}
                disabled={appleMusicLoading}
                className="p-2 rounded-lg bg-gradient-to-r from-pink-500/20 to-red-500/20 hover:from-pink-500/30 hover:to-red-500/30 border border-pink-500/20 transition-all"
                title="Open in Apple Music"
              >
                {appleMusicLoading ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.38-.94.093-2.003 1.116-2.439.285-.12.578-.217.878-.274.374-.07.754-.112 1.13-.171.265-.042.528-.092.786-.16.304-.078.472-.282.506-.596.01-.095.015-.19.015-.285V7.087c0-.206-.038-.386-.238-.47-.116-.05-.243-.073-.37-.086-.343-.036-.687-.065-1.03-.098l-2.825-.27-1.96-.188c-.083-.008-.167-.012-.25-.023-.17-.023-.295.05-.357.2-.03.076-.043.16-.043.242v7.63c0 .32-.02.64-.11.95-.19.64-.53 1.15-1.1 1.51-.34.21-.72.33-1.11.39-.5.07-.99.07-1.48-.05-.87-.22-1.45-.8-1.65-1.67-.21-.91.17-1.89 1.05-2.35.37-.19.77-.31 1.18-.39.47-.09.94-.15 1.41-.23.27-.05.54-.1.8-.17.28-.08.47-.27.52-.56.02-.1.02-.21.02-.31V4.67c0-.19.03-.38.12-.55.12-.21.31-.32.54-.32.1 0 .2.01.3.03.46.05.93.1 1.39.15l3.4.33 2.74.26c.3.03.6.06.9.11.17.03.3.13.36.3.04.1.05.2.05.31v5.33z"/>
                  </svg>
                )}
              </motion.button>
              
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={`https://open.spotify.com/track/${displayState.trackUri.replace('spotify:track:', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 transition-all"
                title="Open in Spotify"
              >
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </motion.a>

              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={`https://music.youtube.com/search?q=${encodeURIComponent(`${displayState.trackName} ${displayState.artistName}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 transition-all"
                title="Open in YouTube Music"
              >
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
                </svg>
              </motion.a>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// Header with user info
function Header({ session, isHost, isGuest, onBack, listenerCount }: { 
  session: Session | null; 
  isHost: boolean; 
  isGuest: boolean;
  onBack?: () => void;
  listenerCount: number;
}) {
  return (
    <GlassCard className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </motion.div>
          <span className="text-white font-medium hidden sm:block">Listen Together</span>
          
          {/* Role badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isHost 
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
              : isGuest 
              ? "bg-white/10 text-white/60 border border-white/20"
              : "bg-green-500/20 text-green-300 border border-green-500/30"
          }`}>
            {isHost ? "Host" : isGuest ? "Guest" : "Listener"}
          </span>

          {/* Listener count */}
          {listenerCount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {listenerCount} {listenerCount === 1 ? 'listener' : 'listeners'}
            </span>
          )}
        </div>

        {/* User info or back button */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={28}
                  height={28}
                  className="rounded-full border border-white/20"
                />
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-all"
              >
                Sign Out
              </motion.button>
            </>
          ) : isGuest && onBack ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-all"
            >
              Back
            </motion.button>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

export function HUD({
  session,
  displayState,
  isHost,
  isGuest,
  syncStatus,
  onJoinAsGuest,
  onOpenAppleMusic,
  appleMusicLoading,
  listenerCount,
  isSyncEnabled,
  onSyncToggle,
  isPremiumListener,
}: HUDProps) {
  // Show landing page for unauthenticated non-guests
  if (!session && !isGuest) {
    return <LandingHUD onJoinAsGuest={onJoinAsGuest} />;
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 pointer-events-auto">
        <Header 
          session={session} 
          isHost={isHost} 
          isGuest={isGuest} 
          onBack={isGuest ? () => window.location.reload() : undefined}
          listenerCount={listenerCount}
        />
      </div>

      {/* Bottom now playing bar */}
      <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto pointer-events-auto">
        <AnimatePresence mode="wait">
          <NowPlayingBar
            displayState={displayState}
            isHost={isHost}
            isGuest={isGuest}
            syncStatus={syncStatus}
            onOpenAppleMusic={onOpenAppleMusic}
            appleMusicLoading={appleMusicLoading}
            isPremiumListener={isPremiumListener}
            isSyncEnabled={isSyncEnabled}
            onSyncToggle={onSyncToggle}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
