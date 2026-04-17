"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

export default function SecureBackground() {
  return (
    <div className="absolute inset-0 z-0 bg-brand-navy overflow-hidden">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <Scene />
      </Canvas>
      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-brand-navy/10 to-brand-navy/60" />
    </div>
  );
}

function Scene() {
  const pointsRef = useRef<THREE.Points>(null);

  // Create a grid of points representing a secure network
  const count = 40;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * count * 3);
    let i = 0;
    for (let x = 0; x < count; x++) {
      for (let z = 0; z < count; z++) {
        pos[i * 3] = (x - count / 2) * 0.4;
        pos[i * 3 + 1] = -1.5; // Flat surface at the bottom
        pos[i * 3 + 2] = (z - count / 2) * 0.4;
        i++;
      }
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();

    // Glacial movement: subtle wave effect
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count * count; i++) {
        const x = positionAttribute.getX(i);
        const z = positionAttribute.getZ(i);
        const y = Math.sin(x * 0.5 + time * 0.2) * 0.1 + Math.cos(z * 0.5 + time * 0.2) * 0.1;
        positionAttribute.setY(i, -1.5 + y);
    }
    positionAttribute.needsUpdate = true;
    
    // Very slow rotation
    pointsRef.current.rotation.y = time * 0.05;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#FFFFFF"
        size={0.015}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.25}
      />
    </Points>
  );
}
