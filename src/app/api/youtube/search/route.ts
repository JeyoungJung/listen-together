import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple in-memory cache for YouTube search results
const searchCache = new Map<string, { videoId: string; title: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Extract video ID from YouTube search results page
async function scrapeYouTubeSearch(query: string): Promise<{ videoId: string; title: string } | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Look for video ID in the page - YouTube embeds it in various places
    // Method 1: Look for videoId in ytInitialData
    const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (videoIdMatch) {
      // Try to extract title too
      const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]/);
      return {
        videoId: videoIdMatch[1],
        title: titleMatch ? titleMatch[1] : query,
      };
    }

    // Method 2: Look for watch?v= links
    const watchMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
      return {
        videoId: watchMatch[1],
        title: query,
      };
    }

    return null;
  } catch (error) {
    console.error("YouTube scrape error:", error);
    return null;
  }
}

// Try Invidious API as backup
async function tryInvidiousSearch(query: string): Promise<{ videoId: string; title: string } | null> {
  const instances = [
    "https://vid.puffyan.us",
    "https://invidious.snopyta.org",
    "https://yewtu.be",
    "https://invidious.kavin.rocks",
    "https://inv.riverside.rocks",
    "https://invidious.flokinet.to",
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { 
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          return {
            videoId: results[0].videoId,
            title: results[0].title,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

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

    // Build search query - try different formats for better results
    const searchQueries = [
      `${track} ${artist} official audio`,
      `${track} ${artist} audio`,
      `${track} ${artist}`,
    ];

    let result: { videoId: string; title: string } | null = null;

    // Try scraping YouTube directly first
    for (const query of searchQueries) {
      result = await scrapeYouTubeSearch(query);
      if (result) break;
    }

    // If scraping failed, try Invidious
    if (!result) {
      for (const query of searchQueries) {
        result = await tryInvidiousSearch(query);
        if (result) break;
      }
    }

    if (result) {
      // Cache the result
      searchCache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        videoId: result.videoId,
        title: result.title,
        cached: false,
      });
    }

    // Return search URL as fallback
    const searchQuery = `${track} ${artist}`;
    return NextResponse.json({
      videoId: null,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      searchQuery,
      error: "Could not find video automatically",
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json(
      { error: "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
