"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import * as THREE from "three";
import { Vinyl } from "./Vinyl";
import { ReactiveOrb } from "./ReactiveOrb";

interface AlbumColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface SceneProps {
  albumArtUrl: string | null;
  isPlaying: boolean;
  tempo: number;
  energy: number;
  albumColors: AlbumColors;
}

// Extract dominant colors from album art
function useAlbumColors(albumArtUrl: string | null): AlbumColors {
  const [colors, setColors] = useState<AlbumColors>({
    primary: "#0a0a20",
    secondary: "#151530",
    accent: "#6b9dff",
  });
  
  const extractColors = useCallback((img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Use small size for faster processing
    const size = 50;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    
    const imageData = ctx.getImageData(0, 0, size, size).data;
    
    // Collect color samples
    const colorBuckets: { [key: string]: { r: number; g: number; b: number; count: number } } = {};
    
    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      
      // Skip very dark or very light colors
      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 235) continue;
      
      // Quantize to reduce similar colors
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
      .filter(c => c.count > 5)
      .sort((a, b) => b.count - a.count)
      .map(c => ({
        r: Math.floor(c.r / c.count),
        g: Math.floor(c.g / c.count),
        b: Math.floor(c.b / c.count),
      }));
    
    if (sortedColors.length === 0) return;
    
    // Get primary (most common), secondary, and accent colors
    const primary = sortedColors[0];
    const secondary = sortedColors[Math.min(1, sortedColors.length - 1)];
    
    // Find a vibrant accent color (high saturation)
    let accent = sortedColors[Math.min(2, sortedColors.length - 1)];
    for (const c of sortedColors.slice(0, 10)) {
      const max = Math.max(c.r, c.g, c.b);
      const min = Math.min(c.r, c.g, c.b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (saturation > 0.4) {
        accent = c;
        break;
      }
    }
    
    // Darken colors for background use (multiply by factor)
    const darken = (c: { r: number; g: number; b: number }, factor: number) => {
      const r = Math.floor(c.r * factor);
      const g = Math.floor(c.g * factor);
      const b = Math.floor(c.b * factor);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };
    
    // Convert accent to full brightness for lights
    const brighten = (c: { r: number; g: number; b: number }) => {
      const max = Math.max(c.r, c.g, c.b, 1);
      const factor = 255 / max;
      const r = Math.min(255, Math.floor(c.r * factor));
      const g = Math.min(255, Math.floor(c.g * factor));
      const b = Math.min(255, Math.floor(c.b * factor));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };
    
    setColors({
      primary: darken(primary, 0.15),
      secondary: darken(secondary, 0.25),
      accent: brighten(accent),
    });
  }, []);
  
  useEffect(() => {
    if (!albumArtUrl) {
      setColors({
        primary: "#0a0a20",
        secondary: "#151530",
        accent: "#6b9dff",
      });
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => extractColors(img);
    img.src = albumArtUrl;
  }, [albumArtUrl, extractColors]);
  
  return colors;
}

// Dynamic background that responds to music and album colors
function DynamicBackground({ 
  energy, 
  isPlaying, 
  albumColors 
}: { 
  energy: number; 
  isPlaying: boolean;
  albumColors: AlbumColors;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  
  // Create gradient shader
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(albumColors.primary) },
    uColor2: { value: new THREE.Color(albumColors.secondary) },
    uColor3: { value: new THREE.Color(albumColors.primary) },
    uIntensity: { value: 0.5 },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;
    
    if (isPlaying) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    
    // Smoothly lerp to album colors
    const targetColor1 = new THREE.Color(albumColors.primary);
    const targetColor2 = new THREE.Color(albumColors.secondary);
    
    // Lerp colors smoothly for nice transitions between tracks
    material.uniforms.uColor1.value.lerp(targetColor1, 0.02);
    material.uniforms.uColor2.value.lerp(targetColor2, 0.02);
    
    // Intensity based on energy
    const targetIntensity = isPlaying ? 0.5 + energy * 0.5 : 0.35;
    material.uniforms.uIntensity.value += (targetIntensity - material.uniforms.uIntensity.value) * 0.02;
  });

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uIntensity;
    
    varying vec2 vUv;
    
    void main() {
      // Radial gradient from center
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center);
      
      // Pulsing effect
      float pulse = sin(uTime * 0.5) * 0.5 + 0.5;
      
      // Mix colors based on distance from center
      vec3 color = mix(uColor2, uColor1, dist * 1.5);
      
      // Add subtle pulsing glow at center
      float glow = (1.0 - dist) * uIntensity * (0.8 + pulse * 0.2);
      color += uColor2 * glow * 0.5;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  return (
    <mesh ref={meshRef} position={[0, 0, -15]} scale={[viewport.width * 3, viewport.height * 3, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

// Animated ambient light that pulses with music
function PulsingAmbient({ energy, isPlaying }: { energy: number; isPlaying: boolean }) {
  const lightRef = useRef<THREE.AmbientLight>(null);
  
  useFrame((state) => {
    if (!lightRef.current) return;
    const pulse = isPlaying ? Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.9 : 1;
    const targetIntensity = (0.15 + energy * 0.1) * pulse;
    lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.05;
  });
  
  return <ambientLight ref={lightRef} intensity={0.2} />;
}

// Animated point light that moves around - color based on album
function MovingLight({ energy, accentColor }: { energy: number; accentColor: string }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const targetColor = useRef(new THREE.Color(accentColor));
  
  useFrame((state) => {
    if (!lightRef.current) return;
    const time = state.clock.elapsedTime;
    
    // Orbit around the scene
    lightRef.current.position.x = Math.sin(time * 0.3) * 5;
    lightRef.current.position.z = Math.cos(time * 0.3) * 5;
    lightRef.current.position.y = 3 + Math.sin(time * 0.5) * 1;
    
    // Smoothly transition to album accent color
    targetColor.current.set(accentColor);
    lightRef.current.color.lerp(targetColor.current, 0.02);
    
    // Intensity based on energy
    const targetIntensity = 30 + energy * 40;
    lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.05;
  });
  
  return (
    <pointLight
      ref={lightRef}
      color={accentColor}
      intensity={40}
      distance={20}
      decay={2}
    />
  );
}

// Secondary accent light - complementary to album color
function AccentLight({ energy, accentColor }: { energy: number; accentColor: string }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const targetColor = useRef(new THREE.Color());
  
  useFrame((state) => {
    if (!lightRef.current) return;
    const time = state.clock.elapsedTime;
    lightRef.current.position.x = Math.cos(time * 0.2) * 6;
    lightRef.current.position.z = Math.sin(time * 0.2) * 6;
    lightRef.current.position.y = 2 + Math.cos(time * 0.4) * 1;
    
    // Create a complementary color by shifting hue
    const baseColor = new THREE.Color(accentColor);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    targetColor.current.setHSL((hsl.h + 0.4) % 1, hsl.s, hsl.l);
    lightRef.current.color.lerp(targetColor.current, 0.02);
    
    const targetIntensity = 20 + energy * 30;
    lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.05;
  });
  
  return (
    <pointLight
      ref={lightRef}
      color="#ff6b9d"
      intensity={30}
      distance={15}
      decay={2}
    />
  );
}

// Floating particles around the scene
function FloatingParticles({ energy }: { energy: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 80;
  
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere around the orb
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 4 + Math.random() * 6;
      
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      
      // Soft white/blue colors
      col[i * 3] = 0.7 + Math.random() * 0.3;
      col[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      col[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }
    
    return [pos, col];
  }, []);
  
  useFrame((state) => {
    if (!particlesRef.current) return;
    const speed = 0.01 + energy * 0.02;
    particlesRef.current.rotation.y = state.clock.elapsedTime * speed;
    particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);
  
  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.4 + energy * 0.3}
        sizeAttenuation
      />
    </points>
  );
}

// Scene content
function Scene({ albumArtUrl, isPlaying, tempo, energy, albumColors }: SceneProps) {
  return (
    <>
      {/* Dynamic background - themed to album art */}
      <DynamicBackground energy={energy} isPlaying={isPlaying} albumColors={albumColors} />
      
      {/* Lighting - colors based on album */}
      <PulsingAmbient energy={energy} isPlaying={isPlaying} />
      <MovingLight energy={energy} accentColor={albumColors.accent} />
      <AccentLight energy={energy} accentColor={albumColors.accent} />
      <pointLight position={[0, 5, 5]} intensity={15} color="#ffffff" />
      
      {/* Stars background - subtle */}
      <Stars
        radius={100}
        depth={50}
        count={1500}
        factor={3}
        saturation={0}
        fade
        speed={0.3}
      />
      
      {/* Floating particles */}
      <FloatingParticles energy={energy} />
      
      {/* Reactive shader orb - main focus */}
      <group position={[0, 0, 0]}>
        <ReactiveOrb tempo={tempo} energy={energy} isPlaying={isPlaying} />
      </group>
      
      {/* The vinyl record - smaller and in front */}
      <Float
        speed={1}
        rotationIntensity={0}
        floatIntensity={0.15}
        floatingRange={[-0.03, 0.03]}
      >
        <group position={[0, 0, 3]} scale={0.7}>
          <Vinyl albumArtUrl={albumArtUrl} isPlaying={isPlaying} />
        </group>
      </Float>
    </>
  );
}

interface ExperienceProps {
  albumArtUrl: string | null;
  isPlaying: boolean;
  tempo?: number;
  energy?: number;
}

export function Experience({ albumArtUrl, isPlaying, tempo = 120, energy = 0.5 }: ExperienceProps) {
  // Extract colors from album art
  const albumColors = useAlbumColors(albumArtUrl);
  
  return (
    <div className="fixed inset-0 -z-10 transition-colors duration-1000" style={{ backgroundColor: albumColors.primary }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.setClearColor(new THREE.Color(albumColors.primary));
        }}
      >
        <Scene 
          albumArtUrl={albumArtUrl} 
          isPlaying={isPlaying} 
          tempo={tempo} 
          energy={energy} 
          albumColors={albumColors}
        />
      </Canvas>
    </div>
  );
}
