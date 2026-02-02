import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getCurrentlyPlaying } from "@/lib/spotify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getCurrentlyPlaying(session.accessToken);

    if (!data) {
      return NextResponse.json({ playing: false });
    }

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
    console.error("Error fetching currently playing:", error);
    return NextResponse.json(
      { error: "Failed to fetch playback state" },
      { status: 500 }
    );
  }
}
