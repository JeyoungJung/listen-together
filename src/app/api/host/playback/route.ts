import { NextResponse } from "next/server";
import { getValidHostAccessToken } from "@/lib/hostTokenStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const accessToken = await getValidHostAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Host not authenticated. Host needs to log in once to enable background sync." },
        { status: 401 }
      );
    }

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 204) {
      return NextResponse.json({ playing: false });
    }

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      playing: data.is_playing,
      track: data.item
        ? {
            uri: data.item.uri,
            name: data.item.name,
            artists: data.item.artists.map((a: { name: string }) => a.name).join(", "),
            album: data.item.album.name,
            albumImage: data.item.album.images[0]?.url,
            durationMs: data.item.duration_ms,
          }
        : null,
      progressMs: data.progress_ms,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error fetching host playback:", error);
    return NextResponse.json(
      { error: "Failed to fetch host playback state" },
      { status: 500 }
    );
  }
}
