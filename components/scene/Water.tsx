"use client";

import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useTerrain } from "./terrainContext";

export default function Water() {
  const terrain = useTerrain();
  const level = terrain.water;
  const size = useMemo(() => terrain.size * 3, [terrain.size]);

  if (level === undefined) return null;

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, level, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={512}
        mixBlur={1.1}
        mixStrength={2.6}
        blur={[320, 90]}
        mirror={0.55}
        depthScale={0.6}
        minDepthThreshold={0.85}
        maxDepthThreshold={1.3}
        color="#16333c"
        metalness={0.55}
        roughness={0.22}
      />
    </mesh>
  );
}
