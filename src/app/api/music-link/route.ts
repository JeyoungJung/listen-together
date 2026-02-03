import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface OdesliResponse {
  linksByPlatform?: {
    appleMusic?: {
      url: string;
    };
    itunes?: {
      url: string;
    };
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const trackId = searchParams.get("trackId");
  const platform = searchParams.get("platform") || "appleMusic";

  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  try {
    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    const odesliUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotifyUrl)}`;

    const response = await fetch(odesliUrl, {
      headers: {
        "User-Agent": "ListenTogether/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Odesli API error: ${response.status}`);
    }

    const data: OdesliResponse = await response.json();

    // Get the requested platform link
    let targetUrl: string | undefined;

    if (platform === "appleMusic") {
      targetUrl = data.linksByPlatform?.appleMusic?.url || data.linksByPlatform?.itunes?.url;
    }

    if (!targetUrl) {
      // Fallback to search if no direct link found
      return NextResponse.json({
        url: null,
        fallback: true,
      });
    }

    return NextResponse.json({ url: targetUrl });
  } catch (error) {
    console.error("Error fetching music link:", error);
    return NextResponse.json(
      { error: "Failed to fetch music link", fallback: true },
      { status: 500 }
    );
  }
}
