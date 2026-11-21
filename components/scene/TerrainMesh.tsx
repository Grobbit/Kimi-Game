"use client";

import { useMemo } from "react";
import { groundTextures } from "@/lib/textures";
import { useTerrain } from "./terrainContext";

export default function TerrainMesh() {
  const terrain = useTerrain();
  const tex = useMemo(() => groundTextures(), []);
  const geo = terrain.geometry;

  return (
    <mesh geometry={geo} receiveShadow castShadow frustumCulled={false}>
      <meshStandardMaterial
        vertexColors
        map={tex.map}
        normalMap={tex.normalMap}
        normalScale={[0.35, 0.35]}
        roughness={0.95}
        metalness={0.02}
        envMapIntensity={0.35}
      />
    </mesh>
  );
}
