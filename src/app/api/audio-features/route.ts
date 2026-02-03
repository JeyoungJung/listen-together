import { NextRequest, NextResponse } from "next/server";
import { getValidHostAccessToken } from "@/lib/hostTokenStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AudioFeatures {
  tempo: number;        // BPM (60-200 typical)
  energy: number;       // 0.0 to 1.0
  danceability: number; // 0.0 to 1.0
  valence: number;      // 0.0 to 1.0 (happiness)
  loudness: number;     // -60 to 0 dB
}

// Cache audio features to reduce API calls
const audioFeaturesCache = new Map<string, { features: AudioFeatures; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (features don't change)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const trackId = searchParams.get("trackId");

  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Check cache first
  const cached = audioFeaturesCache.get(trackId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.features);
  }

  try {
    const accessToken = await getValidHostAccessToken();
    
    if (!accessToken) {
      // Return default values if no token
      return NextResponse.json({
        tempo: 120,
        energy: 0.5,
        danceability: 0.5,
        valence: 0.5,
        loudness: -10,
      });
    }

    const response = await fetch(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      // Return default values on error
      return NextResponse.json({
        tempo: 120,
        energy: 0.5,
        danceability: 0.5,
        valence: 0.5,
        loudness: -10,
      });
    }

    const data = await response.json();

    const features: AudioFeatures = {
      tempo: data.tempo || 120,
      energy: data.energy || 0.5,
      danceability: data.danceability || 0.5,
      valence: data.valence || 0.5,
      loudness: data.loudness || -10,
    };

    // Cache the result
    audioFeaturesCache.set(trackId, { features, timestamp: Date.now() });

    return NextResponse.json(features);
  } catch (error) {
    console.error("Error fetching audio features:", error);
    return NextResponse.json({
      tempo: 120,
      energy: 0.5,
      danceability: 0.5,
      valence: 0.5,
      loudness: -10,
    });
  }
}
