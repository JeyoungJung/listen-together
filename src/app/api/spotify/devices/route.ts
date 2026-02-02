import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDevices, transferPlayback } from "@/lib/spotify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getDevices(session.accessToken);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, play } = await request.json();

    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    await transferPlayback(session.accessToken, deviceId, play);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error transferring playback:", error);
    return NextResponse.json(
      { error: "Failed to transfer playback" },
      { status: 500 }
    );
  }
}
