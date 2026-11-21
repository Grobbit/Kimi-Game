"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useWorld } from "@/lib/store";
import { asphaltTexture } from "@/lib/textures";
import { useTerrain } from "./terrainContext";

export default function Road() {
  const terrain = useTerrain();
  const road = useWorld((s) => s.road);
  const tex = useMemo(() => asphaltTexture(), []);

  const geometry = useMemo(() => {
    if (!road) return null;
    const step = 12;
    const n = Math.max(24, Math.floor(road.len / step));
    let x = 0;
    let z = 60;
    let heading = 0;
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i < n; i++) {
      pts.push(new THREE.Vector3(x, terrain.sample(x, z), z));
      heading +=
        Math.sin(i * 0.29) * 0.26 * road.curv +
        Math.sin(i * 0.107 + 1.4) * 0.14 * road.curv;
      x += -Math.sin(heading) * step;
      z += -Math.cos(heading) * step;
      if (Math.abs(x) > terrain.size * 0.42 || Math.abs(z) > terrain.size * 0.42)
        break;
    }

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const N = Math.min(1100, Math.max(80, Math.floor(road.len / 1.6)));
    const samples = curve.getSpacedPoints(N);
    const width = 8.2;
    const positions = new Float32Array((N + 1) * 2 * 3);
    const uvs = new Float32Array((N + 1) * 2 * 2);
    const index: number[] = [];

    let dist = 0;
    for (let i = 0; i <= N; i++) {
      const p = samples[Math.min(i, samples.length - 1)];
      const prev = samples[Math.max(0, i - 1)];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;
      const y = terrain.sample(p.x, p.z) + 0.07;
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z);

      const k = i * 2;
      positions[k * 3] = p.x + nx * width * 0.5;
      positions[k * 3 + 1] = y;
      positions[k * 3 + 2] = p.z + nz * width * 0.5;
      positions[(k + 1) * 3] = p.x - nx * width * 0.5;
      positions[(k + 1) * 3 + 1] = y;
      positions[(k + 1) * 3 + 2] = p.z - nz * width * 0.5;

      uvs[k * 2] = 0;
      uvs[k * 2 + 1] = dist / 18;
      uvs[(k + 1) * 2] = 1;
      uvs[(k + 1) * 2 + 1] = dist / 18;

      if (i < N) {
        const a = k;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [road, terrain]);

  if (!road || !geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={tex}
        roughness={0.86}
        metalness={0.05}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}
