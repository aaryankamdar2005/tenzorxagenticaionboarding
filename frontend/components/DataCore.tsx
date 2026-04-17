"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

interface DataCoreProps {
  isConnecting: boolean;
}

export default function DataCore({ isConnecting }: DataCoreProps) {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00E5FF" />
        <Scene isConnecting={isConnecting} />
      </Canvas>
    </div>
  );
}

function Scene({ isConnecting }: DataCoreProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const pos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 1.5 + Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    const { mouse } = state;
    
    if (sphereRef.current) {
      sphereRef.current.rotation.y += 0.005;
      sphereRef.current.rotation.x += 0.002;
      
      if (isConnecting) {
        sphereRef.current.rotation.y += 0.1;
        sphereRef.current.scale.lerp(new THREE.Vector3(20, 20, 20), 0.05);
      }
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y -= 0.002;
    }

    if (groupRef.current) {
      // Smoothly tilt toward mouse
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -mouse.y * 0.1, 0.05);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, mouse.x * 0.1, 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      <Icosahedron ref={sphereRef} args={[1, 4]}>
        <meshStandardMaterial 
          color="#00E5FF" 
          wireframe 
          emissive="#00E5FF" 
          emissiveIntensity={4} 
          transparent 
          opacity={0.6}
        />
      </Icosahedron>
      
      <Points ref={particlesRef} positions={particles} stride={3}>
        <PointMaterial
          transparent
          color="#00E5FF"
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  );
}
