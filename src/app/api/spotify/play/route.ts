import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { playTrack, pausePlayback, seekToPosition } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { trackUri, positionMs, deviceId, action } = body;

    if (action === "pause") {
      await pausePlayback(session.accessToken, deviceId);
      return NextResponse.json({ success: true });
    }

    if (action === "seek") {
      await seekToPosition(session.accessToken, positionMs, deviceId);
      return NextResponse.json({ success: true });
    }

    if (!trackUri) {
      return NextResponse.json(
        { error: "Track URI is required" },
        { status: 400 }
      );
    }

    await playTrack(session.accessToken, trackUri, positionMs || 0, deviceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error controlling playback:", error);
    return NextResponse.json(
      { error: "Failed to control playback" },
      { status: 500 }
    );
  }
}
