"use client";

import { motion, AnimatePresence } from "framer-motion";
import { signIn, signOut } from "next-auth/react";
import { Session } from "next-auth";
import Image from "next/image";
import { HostUpdate } from "@/types/spotify";

// Spring animation config
const spring = { type: "spring", stiffness: 400, damping: 30 };
const springGentle = { type: "spring", stiffness: 260, damping: 20 };

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
  youtubeEnabled?: boolean;
  onYoutubeToggle?: (enabled: boolean) => void;
  youtubeStatus?: { isPlaying: boolean; isMuted: boolean };
  onYoutubeMuteToggle?: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Glassmorphism card with refined styling
function GlassCard({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={springGentle}
      className={`
        backdrop-blur-2xl bg-black/40
        border border-white/[0.08]
        rounded-3xl
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

// Icon button with accessibility
function IconButton({ 
  onClick, 
  label, 
  children,
  variant = "ghost",
  active = false,
}: { 
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  variant?: "ghost" | "subtle";
  active?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={onClick}
      aria-label={label}
      className={`
        p-2.5 rounded-2xl transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent
        ${variant === "ghost" 
          ? "hover:bg-white/[0.08] active:bg-white/[0.12]" 
          : "bg-white/[0.06] hover:bg-white/[0.1]"
        }
        ${active ? "bg-white/[0.12]" : ""}
      `}
    >
      {children}
    </motion.button>
  );
}

// Landing screen
function LandingHUD({ onJoinAsGuest }: { onJoinAsGuest: () => void }) {
  return (
    <main className="fixed inset-0 flex items-center justify-center z-10 p-6">
      <GlassCard className="max-w-sm w-full p-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center space-y-8"
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Listen Together</h1>
              <p className="text-white/50 text-sm mt-1 font-light">Real-time music experience</p>
            </div>
          </div>

          {/* Actions */}
          <nav className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={() => signIn("spotify")}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-white font-medium text-[15px] transition-colors duration-200 flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:ring-offset-2 focus:ring-offset-transparent"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Continue with Spotify
            </motion.button>

            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-white/30 text-xs font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={onJoinAsGuest}
              className="w-full py-3.5 px-5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/80 font-medium text-[15px] transition-colors duration-200 flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent"
            >
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Join as Guest
            </motion.button>
          </nav>

          <p className="text-white/25 text-xs">
            Premium required for playback sync
          </p>
        </motion.div>
      </GlassCard>
    </main>
  );
}

// Now Playing
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
  youtubeEnabled,
  onYoutubeToggle,
  youtubeStatus,
  onYoutubeMuteToggle,
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
  youtubeEnabled?: boolean;
  onYoutubeToggle?: (enabled: boolean) => void;
  youtubeStatus?: { isPlaying: boolean; isMuted: boolean };
  onYoutubeMuteToggle?: () => void;
}) {
  if (!displayState?.trackName) {
    return (
      <GlassCard className="p-8">
        <motion.div
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-center space-y-2"
        >
          <p className="text-white/60 text-lg font-light tracking-tight">Waiting for music</p>
          <p className="text-white/30 text-sm">
            {isHost ? "Play something on Spotify" : "Host will start playing soon"}
          </p>
        </motion.div>
      </GlassCard>
    );
  }

  const progressPercent = displayState.durationMs > 0 
    ? (displayState.progressMs / displayState.durationMs) * 100 
    : 0;

  const getStatusText = () => {
    if (isHost) return "Broadcasting";
    if (isGuest && youtubeEnabled) return "YouTube";
    if (isGuest) return "Guest";
    if (isPremiumListener && isSyncEnabled) return "Synced";
    return "Connected";
  };

  return (
    <GlassCard className="p-5">
      <div className="space-y-5">
        {/* Track info */}
        <div className="flex items-center gap-4">
          {displayState.albumImageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springGentle}
              className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0 ring-1 ring-white/[0.08]"
            >
              <Image
                src={displayState.albumImageUrl}
                alt={displayState.albumName || "Album artwork"}
                fill
                className="object-cover"
              />
            </motion.div>
          )}
          
          <div className="flex-1 min-w-0 space-y-0.5">
            <motion.h2
              key={displayState.trackName}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className="text-white font-medium text-[15px] truncate tracking-tight"
            >
              {displayState.trackName}
            </motion.h2>
            <p className="text-white/50 text-sm truncate font-light">{displayState.artistName}</p>
          </div>
          
          {/* Playing indicator */}
          {displayState.isPlaying ? (
            <div className="flex items-end gap-0.5 h-4" aria-label="Now playing">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ height: ["40%", "100%", "40%"] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                  className="w-0.5 bg-emerald-400 rounded-full"
                />
              ))}
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white/30 rounded-sm" />
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "linear" }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-white/30 font-medium tabular-nums">
            <span>{formatTime(displayState.progressMs)}</span>
            <span>{formatTime(displayState.durationMs)}</span>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center justify-between pt-1">
          {/* Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === "synced" || displayState.isPlaying 
                  ? "bg-emerald-400" 
                  : "bg-amber-400"
              }`} />
              <span className="text-white/40 text-xs font-medium">{getStatusText()}</span>
            </div>
            
            {/* YouTube status */}
            {youtubeEnabled && youtubeStatus && (
              <motion.div
                animate={{ 
                  boxShadow: youtubeStatus.isPlaying 
                    ? ["0 0 0 0 rgba(239,68,68,0)", "0 0 0 4px rgba(239,68,68,0.15)", "0 0 0 0 rgba(239,68,68,0)"]
                    : "none"
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20"
              >
                <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                <span className="text-red-300/80 text-[11px] font-medium">
                  {youtubeStatus.isPlaying ? "Playing" : "Paused"}
                </span>
                
                {onYoutubeMuteToggle && (
                  <button
                    onClick={onYoutubeMuteToggle}
                    aria-label={youtubeStatus.isMuted ? "Unmute" : "Mute"}
                    className="p-0.5 -mr-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      {youtubeStatus.isMuted ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      )}
                    </svg>
                  </button>
                )}
                
                {onYoutubeToggle && (
                  <button
                    onClick={() => onYoutubeToggle(false)}
                    aria-label="Stop YouTube"
                    className="p-0.5 -mr-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* Service buttons */}
          {(isGuest || !isHost) && displayState.trackUri && (
            <div className="flex items-center gap-1.5">
              {/* Sync toggle */}
              {isPremiumListener && onSyncToggle && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  transition={spring}
                  onClick={() => onSyncToggle(!isSyncEnabled)}
                  aria-label={isSyncEnabled ? "Disable sync" : "Enable sync"}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
                    isSyncEnabled 
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" 
                      : "bg-white/[0.06] text-white/50 border border-white/[0.08]"
                  }`}
                >
                  {isSyncEnabled ? "Synced" : "Sync"}
                </motion.button>
              )}
              
              <IconButton
                onClick={() => onOpenAppleMusic(displayState.trackUri!)}
                label="Open in Apple Music"
                variant="subtle"
              >
                {appleMusicLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.38-.94.093-2.003 1.116-2.439.285-.12.578-.217.878-.274.374-.07.754-.112 1.13-.171.265-.042.528-.092.786-.16.304-.078.472-.282.506-.596.01-.095.015-.19.015-.285V7.087c0-.206-.038-.386-.238-.47-.116-.05-.243-.073-.37-.086-.343-.036-.687-.065-1.03-.098l-2.825-.27-1.96-.188c-.083-.008-.167-.012-.25-.023-.17-.023-.295.05-.357.2-.03.076-.043.16-.043.242v7.63c0 .32-.02.64-.11.95-.19.64-.53 1.15-1.1 1.51-.34.21-.72.33-1.11.39-.5.07-.99.07-1.48-.05-.87-.22-1.45-.8-1.65-1.67-.21-.91.17-1.89 1.05-2.35.37-.19.77-.31 1.18-.39.47-.09.94-.15 1.41-.23.27-.05.54-.1.8-.17.28-.08.47-.27.52-.56.02-.1.02-.21.02-.31V4.67c0-.19.03-.38.12-.55.12-.21.31-.32.54-.32.1 0 .2.01.3.03.46.05.93.1 1.39.15l3.4.33 2.74.26c.3.03.6.06.9.11.17.03.3.13.36.3.04.1.05.2.05.31v5.33z"/>
                  </svg>
                )}
              </IconButton>
              
              <a
                href={`https://open.spotify.com/track/${displayState.trackUri.replace('spotify:track:', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Spotify"
                className="p-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
              >
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </a>

              {isGuest && onYoutubeToggle && (
                <IconButton
                  onClick={() => onYoutubeToggle(!youtubeEnabled)}
                  label={youtubeEnabled ? "Stop YouTube" : "Play on YouTube"}
                  variant="subtle"
                  active={youtubeEnabled}
                >
                  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                </IconButton>
              )}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// Header
function Header({ session, isHost, isGuest, onBack, listenerCount }: { 
  session: Session | null; 
  isHost: boolean; 
  isGuest: boolean;
  onBack?: () => void;
  listenerCount: number;
}) {
  return (
    <GlassCard className="px-4 py-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </motion.div>
          
          <span className="text-white/90 font-medium text-sm hidden sm:block tracking-tight">Listen Together</span>
          
          {/* Role badge */}
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${
            isHost 
              ? "bg-violet-500/20 text-violet-300" 
              : isGuest 
              ? "bg-white/[0.08] text-white/50"
              : "bg-emerald-500/20 text-emerald-300"
          }`}>
            {isHost ? "Host" : isGuest ? "Guest" : "Listener"}
          </span>

          {/* Listener count */}
          {listenerCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-white/[0.06] text-white/40 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              {listenerCount}
            </span>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          {session ? (
            <>
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={28}
                  height={28}
                  className="rounded-full ring-1 ring-white/[0.08]"
                />
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={spring}
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 text-xs font-medium transition-colors"
              >
                Sign Out
              </motion.button>
            </>
          ) : isGuest && onBack ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={spring}
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 text-xs font-medium transition-colors"
            >
              Back
            </motion.button>
          ) : null}
        </div>
      </header>
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
  youtubeEnabled,
  onYoutubeToggle,
  youtubeStatus,
  onYoutubeMuteToggle,
}: HUDProps) {
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

      {/* Now Playing */}
      <div className="absolute bottom-6 left-4 right-4 max-w-md mx-auto pointer-events-auto">
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
            youtubeEnabled={youtubeEnabled}
            onYoutubeToggle={onYoutubeToggle}
            youtubeStatus={youtubeStatus}
            onYoutubeMuteToggle={onYoutubeMuteToggle}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
