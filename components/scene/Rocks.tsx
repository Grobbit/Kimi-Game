"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES } from "@/lib/biomes";
import { useTerrain } from "./terrainContext";

export default function Rocks() {
  const terrain = useTerrain();
  const biome = BIOMES[terrain.biome];
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = biome.rockCount;

  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(
        0.72 + 0.3 * Math.sin(v.x * 3.1 + v.z * 2.2) + 0.16 * Math.cos(v.y * 5.3),
      );
      p.setXYZ(i, v.x, v.y * 0.8, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    let seed = 991 + count;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const base = new THREE.Color(biome.rock);

    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      let y = 0;
      let tries = 0;
      do {
        const r = 18 + Math.sqrt(rnd()) * 330;
        const a = rnd() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = terrain.sample(x, z);
        tries++;
      } while (
        tries < 10 &&
        terrain.water !== undefined &&
        y < terrain.water + 0.3
      );

      const s = 0.55 + Math.pow(rnd(), 2.2) * 4.6;
      dummy.position.set(x, y + s * 0.32, z);
      dummy.rotation.set(rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6);
      dummy.scale.set(s * (0.8 + rnd() * 0.6), s * (0.55 + rnd() * 0.6), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.copy(base).multiplyScalar(0.75 + rnd() * 0.5);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [terrain, biome, count]);

  return (
    <instancedMesh
      ref={ref}
      args={[geo, undefined, count]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial roughness={0.88} metalness={0.04} flatShading />
    </instancedMesh>
  );
}
