// Simple file-based token store for the host
// In production, use a database like Redis or PostgreSQL

import fs from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), ".host-tokens.json");

interface HostTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function saveHostTokens(tokens: HostTokens): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log("Host tokens saved");
  } catch (error) {
    console.error("Failed to save host tokens:", error);
  }
}

export function getHostTokens(): HostTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const data = fs.readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read host tokens:", error);
    return null;
  }
}

export async function getValidHostAccessToken(): Promise<string | null> {
  const tokens = getHostTokens();
  if (!tokens) {
    return null;
  }

  // Check if token is still valid (with 1 minute buffer)
  if (Date.now() < tokens.expiresAt - 60000) {
    return tokens.accessToken;
  }

  // Token expired, refresh it
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh host token");
      return null;
    }

    const data = await response.json();
    
    const newTokens: HostTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    saveHostTokens(newTokens);
    return newTokens.accessToken;
  } catch (error) {
    console.error("Error refreshing host token:", error);
    return null;
  }
}
