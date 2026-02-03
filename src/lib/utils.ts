/**
 * Format milliseconds to MM:SS format
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Extract track ID from Spotify URI
 */
export function extractTrackId(trackUri: string | null): string | null {
  if (!trackUri) return null;
  return trackUri.replace('spotify:track:', '');
}
