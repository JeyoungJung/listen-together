"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import * as THREE from "three";
import { Vinyl } from "./Vinyl";
import { ReactiveOrb } from "./ReactiveOrb";

interface SceneProps {
  albumArtUrl: string | null;
  isPlaying: boolean;
  tempo: number;
  energy: number;
}

// Dynamic background that responds to music
function DynamicBackground({ tempo, energy, isPlaying }: { tempo: number; energy: number; isPlaying: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  
  // Create gradient shader
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color("#0a0a20") },
    uColor2: { value: new THREE.Color("#151530") },
    uColor3: { value: new THREE.Color("#0a0a20") },
    uIntensity: { value: 0.5 },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.ShaderMaterial;
    
    if (isPlaying) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    
    // Calculate target colors based on tempo
    const tempoNorm = Math.min(Math.max((tempo - 60) / 140, 0), 1);
    
    let targetColor1, targetColor2;
    
    if (tempoNorm < 0.33) {
      // Slow: Deep blue/teal
      targetColor1 = new THREE.Color("#0a2535");
      targetColor2 = new THREE.Color("#154050");
    } else if (tempoNorm < 0.66) {
      // Mid: Purple/magenta
      targetColor1 = new THREE.Color("#250a35");
      targetColor2 = new THREE.Color("#351550");
    } else {
      // Fast: Warm orange/red
      targetColor1 = new THREE.Color("#2a150a");
      targetColor2 = new THREE.Color("#402520");
    }
    
    // Lerp colors
    material.uniforms.uColor1.value.lerp(targetColor1, 0.01);
    material.uniforms.uColor2.value.lerp(targetColor2, 0.01);
    
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

// Animated point light that moves around - color changes with tempo
function MovingLight({ tempo, energy }: { tempo: number; energy: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const targetColor = useRef(new THREE.Color());
  
  useFrame((state) => {
    if (!lightRef.current) return;
    const time = state.clock.elapsedTime;
    
    // Orbit around the scene
    lightRef.current.position.x = Math.sin(time * 0.3) * 5;
    lightRef.current.position.z = Math.cos(time * 0.3) * 5;
    lightRef.current.position.y = 3 + Math.sin(time * 0.5) * 1;
    
    // Color shifts based on tempo
    const tempoNorm = Math.min(Math.max((tempo - 60) / 140, 0), 1);
    targetColor.current.setHSL(0.55 - tempoNorm * 0.5, 0.7, 0.5 + energy * 0.2);
    lightRef.current.color.lerp(targetColor.current, 0.02);
    
    // Intensity based on energy
    const targetIntensity = 30 + energy * 40;
    lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.05;
  });
  
  return (
    <pointLight
      ref={lightRef}
      color="#6b9dff"
      intensity={40}
      distance={20}
      decay={2}
    />
  );
}

// Secondary accent light
function AccentLight({ energy }: { energy: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame((state) => {
    if (!lightRef.current) return;
    const time = state.clock.elapsedTime;
    lightRef.current.position.x = Math.cos(time * 0.2) * 6;
    lightRef.current.position.z = Math.sin(time * 0.2) * 6;
    lightRef.current.position.y = 2 + Math.cos(time * 0.4) * 1;
    
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
function Scene({ albumArtUrl, isPlaying, tempo, energy }: SceneProps) {
  return (
    <>
      {/* Dynamic background */}
      <DynamicBackground tempo={tempo} energy={energy} isPlaying={isPlaying} />
      
      {/* Lighting */}
      <PulsingAmbient energy={energy} isPlaying={isPlaying} />
      <MovingLight tempo={tempo} energy={energy} />
      <AccentLight energy={energy} />
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
  // Calculate background color based on tempo for CSS fallback
  const [bgColor, setBgColor] = useState("#0a0a20");
  
  useEffect(() => {
    const tempoNorm = Math.min(Math.max((tempo - 60) / 140, 0), 1);
    let color;
    if (tempoNorm < 0.33) {
      color = "#0a1520"; // Teal tint
    } else if (tempoNorm < 0.66) {
      color = "#180a20"; // Purple tint
    } else {
      color = "#201008"; // Warm tint
    }
    setBgColor(color);
  }, [tempo]);
  
  return (
    <div className="fixed inset-0 -z-10 transition-colors duration-1000" style={{ backgroundColor: bgColor }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.setClearColor(new THREE.Color(bgColor));
        }}
      >
        <Scene albumArtUrl={albumArtUrl} isPlaying={isPlaying} tempo={tempo} energy={energy} />
      </Canvas>
    </div>
  );
}
