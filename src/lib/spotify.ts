import SpotifyWebApi from "spotify-web-api-node";

export function createSpotifyApi(accessToken?: string): SpotifyWebApi {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  if (accessToken) {
    spotifyApi.setAccessToken(accessToken);
  }

  return spotifyApi;
}

export async function getCurrentlyPlaying(accessToken: string) {
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

export async function getPlaybackState(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me/player", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

export async function playTrack(
  accessToken: string,
  trackUri: string,
  positionMs: number,
  deviceId?: string
) {
  const body: { uris: string[]; position_ms: number } = {
    uris: [trackUri],
    position_ms: positionMs,
  };

  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    : "https://api.spotify.com/v1/me/player/play";

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to play track: ${JSON.stringify(error)}`);
  }

  return true;
}

export async function pausePlayback(accessToken: string, deviceId?: string) {
  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`
    : "https://api.spotify.com/v1/me/player/pause";

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to pause playback`);
  }

  return true;
}

export async function seekToPosition(
  accessToken: string,
  positionMs: number,
  deviceId?: string
) {
  const url = new URL("https://api.spotify.com/v1/me/player/seek");
  url.searchParams.set("position_ms", positionMs.toString());
  if (deviceId) {
    url.searchParams.set("device_id", deviceId);
  }

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to seek to position`);
  }

  return true;
}

export async function transferPlayback(
  accessToken: string,
  deviceId: string,
  play: boolean = false
) {
  const response = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to transfer playback`);
  }

  return true;
}

export async function getDevices(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get devices`);
  }

  return response.json();
}
