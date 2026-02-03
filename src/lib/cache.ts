/**
 * Cache for prefetched Apple Music links
 */
const appleMusicLinkCache = new Map<string, string>();

/**
 * Cache for audio features
 */
const audioFeaturesCache = new Map<string, { tempo: number; energy: number }>();

export function getAppleMusicLink(trackId: string): string | undefined {
  return appleMusicLinkCache.get(trackId);
}

export function setAppleMusicLink(trackId: string, url: string): void {
  appleMusicLinkCache.set(trackId, url);
}

export function hasAppleMusicLink(trackId: string): boolean {
  return appleMusicLinkCache.has(trackId);
}

export function getCachedAudioFeatures(trackId: string): { tempo: number; energy: number } | undefined {
  return audioFeaturesCache.get(trackId);
}

export function cacheAudioFeatures(trackId: string, features: { tempo: number; energy: number }): void {
  audioFeaturesCache.set(trackId, features);
}
