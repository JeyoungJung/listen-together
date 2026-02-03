"use client";

import { useRef, useMemo, useEffect, useState } from "react";
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

// Cache for album colors
const albumColorCache = new Map<string, AlbumColors>();

// Extract dominant colors from album art via server API (bypasses CORS)
function useAlbumColors(albumArtUrl: string | null): AlbumColors {
  const defaultColors: AlbumColors = {
    primary: "#2d1b4e",
    secondary: "#4a2c7a",
    accent: "#9b59b6",
  };
  
  const [colors, setColors] = useState<AlbumColors>(defaultColors);
  const lastUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!albumArtUrl) {
      setColors(defaultColors);
      return;
    }
    
    // Skip if same URL
    if (albumArtUrl === lastUrlRef.current) {
      return;
    }
    lastUrlRef.current = albumArtUrl;
    
    // Check client-side cache first
    const cached = albumColorCache.get(albumArtUrl);
    if (cached) {
      setColors(cached);
      return;
    }
    
    // Fetch colors from server API
    const fetchColors = async () => {
      try {
        const response = await fetch(`/api/album-colors?imageUrl=${encodeURIComponent(albumArtUrl)}`);
        if (!response.ok) throw new Error("Failed to fetch colors");
        
        const data = await response.json();
        const newColors: AlbumColors = {
          primary: data.primary || defaultColors.primary,
          secondary: data.secondary || defaultColors.secondary,
          accent: data.accent || defaultColors.accent,
        };
        
        // Cache the result
        albumColorCache.set(albumArtUrl, newColors);
        
        // Limit cache size
        if (albumColorCache.size > 50) {
          const firstKey = albumColorCache.keys().next().value;
          if (firstKey) albumColorCache.delete(firstKey);
        }
        
        setColors(newColors);
      } catch (error) {
        console.warn("Error fetching album colors:", error);
        // Keep current colors on error
      }
    };
    
    fetchColors();
  }, [albumArtUrl]);
  
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

// Component to sync clear color with album colors
function ClearColorSync({ color }: { color: string }) {
  const { gl } = useThree();
  
  useEffect(() => {
    gl.setClearColor(new THREE.Color(color));
  }, [gl, color]);
  
  return null;
}

export function Experience({ albumArtUrl, isPlaying, tempo = 120, energy = 0.5 }: ExperienceProps) {
  // Extract colors from album art
  const albumColors = useAlbumColors(albumArtUrl);
  
  // Create gradient style for CSS fallback
  const gradientStyle = {
    background: `radial-gradient(ellipse at center, ${albumColors.secondary} 0%, ${albumColors.primary} 70%, #000000 100%)`,
  };
  
  return (
    <div className="fixed inset-0 -z-10 transition-all duration-1000" style={gradientStyle}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <ClearColorSync color={albumColors.primary} />
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
