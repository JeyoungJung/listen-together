import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple in-memory cache for YouTube search results
const searchCache = new Map<string, { videoId: string; title: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const track = searchParams.get("track");
    const artist = searchParams.get("artist");

    if (!track || !artist) {
      return NextResponse.json(
        { error: "Track and artist are required" },
        { status: 400 }
      );
    }

    const cacheKey = `${track}-${artist}`.toLowerCase();
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        videoId: cached.videoId,
        title: cached.title,
        cached: true,
      });
    }

    // Search YouTube using the Invidious API (no API key required)
    // Invidious is an open-source YouTube frontend with a public API
    const searchQuery = encodeURIComponent(`${track} ${artist} official audio`);
    
    // Try multiple Invidious instances for reliability
    const instances = [
      "https://vid.puffyan.us",
      "https://invidious.snopyta.org",
      "https://yewtu.be",
      "https://invidious.kavin.rocks",
    ];

    let videoId: string | null = null;
    let videoTitle: string | null = null;

    for (const instance of instances) {
      try {
        const response = await fetch(
          `${instance}/api/v1/search?q=${searchQuery}&type=video`,
          { 
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(5000), // 5 second timeout
          }
        );

        if (response.ok) {
          const results = await response.json();
          if (results && results.length > 0) {
            // Get the first result
            videoId = results[0].videoId;
            videoTitle = results[0].title;
            break;
          }
        }
      } catch {
        // Try next instance
        continue;
      }
    }

    // Fallback: Use YouTube's oEmbed endpoint to verify a constructed search URL
    if (!videoId) {
      // As a last resort, return a search URL that will work in the embed
      // YouTube doesn't have a public search API, so we'll use a workaround
      const ytSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
      
      return NextResponse.json({
        videoId: null,
        searchUrl: ytSearchUrl,
        searchQuery: `${track} ${artist}`,
        error: "Could not find exact video, please search manually",
      });
    }

    // Cache the result
    searchCache.set(cacheKey, {
      videoId,
      title: videoTitle || `${track} - ${artist}`,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      videoId,
      title: videoTitle,
      cached: false,
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
