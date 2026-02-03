import { NextRequest, NextResponse } from "next/server";

// Cache colors to avoid re-fetching
const colorCache = new Map<string, { primary: string; secondary: string; accent: string }>();

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
    
    // Simple color extraction using raw pixel data
    // For JPEG/PNG we need to decode - using a simple sampling approach
    const colors = extractColorsFromBuffer(buffer);
    
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
    return NextResponse.json({
      primary: "#1a1a35",
      secondary: "#252545", 
      accent: "#6b9dff",
    });
  }
}

function extractColorsFromBuffer(buffer: Buffer): { primary: string; secondary: string; accent: string } {
  // For JPEG images, we can sample some bytes to estimate dominant colors
  // This is a simplified approach - looking for color patterns in the compressed data
  
  const colorBuckets: { [key: string]: { r: number; g: number; b: number; count: number } } = {};
  
  // Sample bytes from the buffer (skip header, sample middle sections)
  const startOffset = Math.min(1000, buffer.length / 4);
  const sampleSize = Math.min(10000, buffer.length - startOffset);
  
  for (let i = startOffset; i < startOffset + sampleSize - 2; i += 3) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    
    // Skip very dark, very light, or gray colors
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 235) continue;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < 0.1) continue; // Skip grays
    
    // Quantize colors
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    
    if (!colorBuckets[key]) {
      colorBuckets[key] = { r: 0, g: 0, b: 0, count: 0 };
    }
    colorBuckets[key].r += r;
    colorBuckets[key].g += g;
    colorBuckets[key].b += b;
    colorBuckets[key].count++;
  }
  
  // Sort by frequency
  const sortedColors = Object.values(colorBuckets)
    .filter(c => c.count > 10)
    .sort((a, b) => b.count - a.count)
    .map(c => ({
      r: Math.floor(c.r / c.count),
      g: Math.floor(c.g / c.count),
      b: Math.floor(c.b / c.count),
      count: c.count,
    }));
  
  if (sortedColors.length === 0) {
    return {
      primary: "#1a1a35",
      secondary: "#252545",
      accent: "#6b9dff",
    };
  }
  
  // Get colors
  const primary = sortedColors[0];
  const secondary = sortedColors[Math.min(1, sortedColors.length - 1)];
  
  // Find a vibrant accent color
  let accent = sortedColors[Math.min(2, sortedColors.length - 1)];
  for (const c of sortedColors.slice(0, 15)) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation > 0.4) {
      accent = c;
      break;
    }
  }
  
  // Convert to background colors (darker but visible)
  const toBackgroundColor = (c: { r: number; g: number; b: number }, targetBrightness: number) => {
    const currentBrightness = (c.r + c.g + c.b) / 3;
    const factor = currentBrightness > 0 ? targetBrightness / currentBrightness : 0.3;
    const r = Math.min(255, Math.max(15, Math.floor(c.r * factor)));
    const g = Math.min(255, Math.max(15, Math.floor(c.g * factor)));
    const b = Math.min(255, Math.max(15, Math.floor(c.b * factor)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };
  
  // Brighten accent for lights
  const brighten = (c: { r: number; g: number; b: number }) => {
    const max = Math.max(c.r, c.g, c.b, 1);
    const factor = 255 / max;
    const r = Math.min(255, Math.floor(c.r * factor));
    const g = Math.min(255, Math.floor(c.g * factor));
    const b = Math.min(255, Math.floor(c.b * factor));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };
  
  return {
    primary: toBackgroundColor(primary, 40),
    secondary: toBackgroundColor(secondary, 55),
    accent: brighten(accent),
  };
}
