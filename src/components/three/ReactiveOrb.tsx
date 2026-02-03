"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ReactiveOrbProps {
  tempo: number;      // BPM (60-200)
  energy: number;     // 0.0 to 1.0
  isPlaying: boolean;
}

// Vertex shader - subtle displacement for organic feel
const vertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  
  // Simple noise function
  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
  }
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Subtle organic displacement
    float displacement = sin(position.x * 3.0 + uTime * 0.5) * 
                        sin(position.y * 3.0 + uTime * 0.3) * 
                        sin(position.z * 3.0 + uTime * 0.4) * 
                        uEnergy * 0.05;
    
    vec3 newPosition = position + normal * displacement;
    
    vec4 worldPosition = modelMatrix * vec4(newPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment shader - glossy gradient sphere with reflections
const fragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uTempo;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  
  void main() {
    // View direction for fresnel and reflections
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);
    
    // Fresnel effect for edge glow
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    
    // Gradient based on position (vertical gradient)
    float gradientFactor = (vPosition.y + 1.0) * 0.5;
    vec3 baseColor = mix(uColor1, uColor2, gradientFactor);
    
    // Add some variation based on angle
    float angleFactor = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    baseColor = mix(baseColor, uColor2, angleFactor * 0.3);
    
    // Specular highlight (fake reflection)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 64.0);
    
    // Secondary specular for more realism
    vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -0.3));
    vec3 halfDir2 = normalize(lightDir2 + viewDir);
    float specular2 = pow(max(dot(normal, halfDir2), 0.0), 32.0);
    
    // Ambient occlusion fake (darker at bottom)
    float ao = smoothstep(-1.0, 0.5, vPosition.y) * 0.5 + 0.5;
    
    // Combine everything
    vec3 color = baseColor * ao;
    
    // Add fresnel rim light
    color += fresnel * mix(uColor1, uColor2, 0.5) * 0.6;
    
    // Add specular highlights
    color += vec3(1.0) * specular * 0.8;
    color += vec3(0.9, 0.95, 1.0) * specular2 * 0.4;
    
    // Subtle inner glow
    float innerGlow = 1.0 - fresnel;
    color += baseColor * innerGlow * 0.2;
    
    // Energy-based brightness pulse
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    color += baseColor * pulse * uEnergy * 0.1;
    
    // Tone mapping for better colors
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Color palettes based on tempo
function getColors(tempo: number, energy: number): [THREE.Color, THREE.Color] {
  const tempoNorm = Math.min(Math.max((tempo - 60) / 140, 0), 1);
  
  // Color palette transitions:
  // Slow (0): Teal/Cyan - calming
  // Mid (0.5): Purple/Pink - balanced
  // Fast (1): Orange/Red - energetic
  
  let color1: THREE.Color, color2: THREE.Color;
  
  if (tempoNorm < 0.33) {
    // Slow: Teal to Cyan
    color1 = new THREE.Color().setHSL(0.5, 0.6 + energy * 0.3, 0.4 + energy * 0.2);
    color2 = new THREE.Color().setHSL(0.45, 0.5 + energy * 0.3, 0.5 + energy * 0.2);
  } else if (tempoNorm < 0.66) {
    // Mid: Purple to Pink
    color1 = new THREE.Color().setHSL(0.8, 0.6 + energy * 0.3, 0.4 + energy * 0.2);
    color2 = new THREE.Color().setHSL(0.9, 0.5 + energy * 0.3, 0.5 + energy * 0.2);
  } else {
    // Fast: Orange to Red
    color1 = new THREE.Color().setHSL(0.05, 0.7 + energy * 0.2, 0.45 + energy * 0.15);
    color2 = new THREE.Color().setHSL(0.08, 0.6 + energy * 0.3, 0.55 + energy * 0.15);
  }
  
  return [color1, color2];
}

export function ReactiveOrb({ tempo, energy, isPlaying }: ReactiveOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetColor1 = useRef(new THREE.Color());
  const targetColor2 = useRef(new THREE.Color());
  const currentColor1 = useRef(new THREE.Color(0.2, 0.6, 0.7));
  const currentColor2 = useRef(new THREE.Color(0.3, 0.7, 0.8));
  
  // Create shader material with uniforms
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uEnergy: { value: energy },
    uTempo: { value: tempo },
    uColor1: { value: new THREE.Color(0.2, 0.6, 0.7) },
    uColor2: { value: new THREE.Color(0.3, 0.7, 0.8) },
  }), []); // Intentionally empty - we update uniforms in useFrame

  // Update uniforms when props change
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const material = meshRef.current.material as THREE.ShaderMaterial;
    
    // Update time
    if (isPlaying) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    
    // Smoothly interpolate energy and tempo
    material.uniforms.uEnergy.value += (energy - material.uniforms.uEnergy.value) * 0.05;
    material.uniforms.uTempo.value += (tempo - material.uniforms.uTempo.value) * 0.05;
    
    // Update colors based on tempo/energy
    const [newColor1, newColor2] = getColors(tempo, energy);
    targetColor1.current.copy(newColor1);
    targetColor2.current.copy(newColor2);
    
    // Smooth color transition
    currentColor1.current.lerp(targetColor1.current, 0.02);
    currentColor2.current.lerp(targetColor2.current, 0.02);
    material.uniforms.uColor1.value.copy(currentColor1.current);
    material.uniforms.uColor2.value.copy(currentColor2.current);
    
    // Gentle floating animation
    const floatSpeed = isPlaying ? 0.5 : 0.2;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * floatSpeed) * 0.1;
    
    // Very subtle rotation
    meshRef.current.rotation.y += isPlaying ? 0.002 : 0.0005;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} scale={2.2}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
