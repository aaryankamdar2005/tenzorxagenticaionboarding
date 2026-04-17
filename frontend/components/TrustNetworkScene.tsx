"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function NodeCloud() {
  const ref = useRef<THREE.Points>(null);
  const nodes = useMemo(() => {
    const temp = new Float32Array(3000);
    for (let i = 0; i < 3000; i += 3) {
      const r = 2 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      temp[i] = r * Math.sin(phi) * Math.cos(theta);
      temp[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      temp[i + 2] = r * Math.cos(phi);
    }
    return temp;
  }, []);

  useFrame((_state, delta) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.y += delta * 0.05;
    ref.current.rotation.x += delta * 0.01;
  });

  return (
    <Points ref={ref} positions={nodes} stride={3} frustumCulled>
      <PointMaterial transparent color="#42ffe4" size={0.02} sizeAttenuation depthWrite={false} />
    </Points>
  );
}

export default function TrustNetworkScene() {
  return (
    <div className="h-[48vh] w-full rounded-2xl border border-cyan-300/20 bg-black/30">
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <NodeCloud />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.8} />
      </Canvas>
    </div>
  );
}
