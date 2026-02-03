import { NextRequest, NextResponse } from "next/server";

// Cache colors to avoid re-fetching
const colorCache = new Map<string, { primary: string; secondary: string; accent: string }>();

// Predefined vibrant color palettes based on common album art themes
const colorPalettes = [
  { primary: "#2d1b4e", secondary: "#4a2c7a", accent: "#9b59b6" }, // Purple
  { primary: "#1b3d4e", secondary: "#2c5a7a", accent: "#3498db" }, // Blue
  { primary: "#4e1b2d", secondary: "#7a2c4a", accent: "#e74c3c" }, // Red
  { primary: "#4e3d1b", secondary: "#7a5a2c", accent: "#f39c12" }, // Orange/Gold
  { primary: "#1b4e3d", secondary: "#2c7a5a", accent: "#2ecc71" }, // Green
  { primary: "#4e1b4e", secondary: "#7a2c7a", accent: "#e91e8c" }, // Pink/Magenta
  { primary: "#1b2d4e", secondary: "#2c4a7a", accent: "#00bcd4" }, // Cyan
  { primary: "#3d1b4e", secondary: "#5a2c7a", accent: "#8e44ad" }, // Deep Purple
];

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("imageUrl");
  
  if (!imageUrl) {
    return NextResponse.json({ error: "Missing imageUrl parameter" }, { status: 400 });
  }
  
  // Check cache
  const cached = colorCache.get(imageUrl);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract colors from the image
    const colors = extractColorsFromBuffer(buffer, imageUrl);
    
    // Cache the result
    colorCache.set(imageUrl, colors);
    
    // Limit cache size
    if (colorCache.size > 100) {
      const firstKey = colorCache.keys().next().value;
      if (firstKey) colorCache.delete(firstKey);
    }
    
    return NextResponse.json(colors);
  } catch (error) {
    console.error("Error extracting colors:", error);
    // Return a random vibrant palette on error
    const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
    return NextResponse.json(palette);
  }
}

function extractColorsFromBuffer(buffer: Buffer, imageUrl: string): { primary: string; secondary: string; accent: string } {
  // Generate a deterministic palette based on the image URL
  // This gives consistent colors for the same image while being visually pleasing
  const hash = simpleHash(imageUrl);
  const paletteIndex = hash % colorPalettes.length;
  const basePalette = colorPalettes[paletteIndex];
  
  // Try to detect dominant color hue from raw data sampling
  const detectedHue = detectDominantHue(buffer);
  
  if (detectedHue !== null) {
    // Generate colors based on detected hue
    return generatePaletteFromHue(detectedHue);
  }
  
  // Fallback to hash-based palette with slight variations
  return {
    primary: adjustColor(basePalette.primary, (hash % 20) - 10),
    secondary: adjustColor(basePalette.secondary, (hash % 20) - 10),
    accent: basePalette.accent,
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function detectDominantHue(buffer: Buffer): number | null {
  // Sample bytes looking for color patterns
  // Skip first 1000 bytes (headers) and sample every 7th byte triplet
  const hueVotes: { [key: number]: number } = {};
  
  const startOffset = Math.min(2000, Math.floor(buffer.length / 3));
  const endOffset = Math.min(buffer.length - 3, startOffset + 30000);
  
  for (let i = startOffset; i < endOffset; i += 7) {
    const r = buffer[i];
    const g = buffer[i + 1] || 0;
    const b = buffer[i + 2] || 0;
    
    // Skip very dark or very light
    const brightness = (r + g + b) / 3;
    if (brightness < 30 || brightness > 220) continue;
    
    // Skip grays
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 30) continue;
    
    // Calculate hue (0-360)
    const hue = rgbToHue(r, g, b);
    const quantizedHue = Math.floor(hue / 30) * 30; // Quantize to 30-degree buckets
    
    hueVotes[quantizedHue] = (hueVotes[quantizedHue] || 0) + 1;
  }
  
  // Find most voted hue
  let maxVotes = 0;
  let dominantHue: number | null = null;
  
  for (const [hue, votes] of Object.entries(hueVotes)) {
    if (votes > maxVotes && votes > 50) { // Minimum threshold
      maxVotes = votes;
      dominantHue = parseInt(hue);
    }
  }
  
  return dominantHue;
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  if (d === 0) return 0;
  
  let h = 0;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  
  return h;
}

function generatePaletteFromHue(hue: number): { primary: string; secondary: string; accent: string } {
  // Generate dark background colors and bright accent from the hue
  const primary = hslToHex(hue, 50, 18);      // Dark, saturated
  const secondary = hslToHex(hue, 45, 25);    // Slightly lighter
  const accent = hslToHex(hue, 80, 55);       // Bright, vivid
  
  return { primary, secondary, accent };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustColor(hex: string, amount: number): string {
  // Slightly adjust a hex color
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
