"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface VinylProps {
  albumArtUrl: string | null;
  isPlaying: boolean;
}

export function Vinyl({ albumArtUrl, isPlaying }: VinylProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [albumTexture, setAlbumTexture] = useState<THREE.Texture | null>(null);
  const targetSpeed = isPlaying ? 0.015 : 0;
  
  // Load album art texture manually
  useEffect(() => {
    if (!albumArtUrl) {
      setAlbumTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    
    loader.load(
      albumArtUrl,
      (texture) => {
        // Use colorSpace for newer three.js (encoding is deprecated)
        (texture as unknown as { colorSpace: string }).colorSpace = "srgb";
        texture.needsUpdate = true;
        setAlbumTexture(texture);
      },
      undefined,
      () => {
        // Error loading - use null texture
        setAlbumTexture(null);
      }
    );

  }, [albumArtUrl]);

  // Create vinyl grooves texture procedurally
  const grooveTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return null;
    
    // Base black color
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw concentric circles for groove effect
    const centerX = 256;
    const centerY = 256;
    
    for (let r = 60; r < 250; r += 2) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = r % 4 === 0 ? "#1a1a1a" : "#0f0f0f";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Add subtle shine
    const gradient = ctx.createRadialGradient(180, 180, 0, 256, 256, 256);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    (texture as unknown as { colorSpace: string }).colorSpace = "srgb";
    return texture;
  }, []);

  // Create fallback label texture
  const fallbackLabelTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return null;
    
    // Dark gradient background
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "#3a3a3a");
    gradient.addColorStop(1, "#1a1a1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    // Add music note icon
    ctx.fillStyle = "#666666";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    (texture as unknown as { colorSpace: string }).colorSpace = "srgb";
    return texture;
  }, []);

  // Animation loop
  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return;
    
    // Smooth speed transition
    const speedDiff = targetSpeed - currentSpeed;
    const newSpeed = currentSpeed + speedDiff * delta * 3;
    setCurrentSpeed(newSpeed);
    
    // Rotate the vinyl
    meshRef.current.rotation.y += newSpeed;
    
    // Floating/wobble animation
    const time = state.clock.elapsedTime;
    groupRef.current.position.y = Math.sin(time * 0.5) * 0.1;
    groupRef.current.rotation.x = Math.sin(time * 0.3) * 0.05 - 0.2;
    groupRef.current.rotation.z = Math.cos(time * 0.4) * 0.02;
  });

  const labelTexture = albumTexture || fallbackLabelTexture;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Main vinyl disc */}
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.05, 64]} />
        <meshStandardMaterial
          map={grooveTexture}
          roughness={0.3}
          metalness={0.8}
          envMapIntensity={0.5}
          color="#111111"
        />
      </mesh>
      
      {/* Center label with album art */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.02, 64]} />
        <meshStandardMaterial
          map={labelTexture}
          roughness={0.5}
          metalness={0.1}
          color={labelTexture ? "#ffffff" : "#333333"}
        />
      </mesh>
      
      {/* Center hole */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 32]} />
        <meshStandardMaterial color="#050505" roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Outer rim highlight */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 64]} />
        <meshStandardMaterial
          color="#333333"
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>
    </group>
  );
}
