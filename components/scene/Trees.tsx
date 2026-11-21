"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES } from "@/lib/biomes";
import { useTerrain } from "./terrainContext";

function lumpy(radius = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      1 +
      0.22 * Math.sin(v.x * 4.1 + v.y * 2.3) +
      0.16 * Math.cos(v.z * 3.7 - v.x * 1.9) +
      0.09 * Math.sin(v.y * 7.3);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export default function Trees() {
  const terrain = useTerrain();
  const biome = BIOMES[terrain.biome];
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);

  const count = Math.max(0, biome.treeCount);
  const canopyCount = count * 3;
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.55, 1, 1, 7), []);
  const canopyGeo = useMemo(() => lumpy(1, 2), []);

  useLayoutEffect(() => {
    const trunks = trunkRef.current;
    const canopies = canopyRef.current;
    if (!trunks || !canopies) return;

    let seed = 777 + count * 13;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    let ci = 0;
    for (let i = 0; i < count; i++) {
      // cluster trees in loose groves
      let x = 0;
      let z = 0;
      let y = 0;
      let tries = 0;
      do {
        const r = 20 + Math.pow(rnd(), 0.7) * 320;
        const a = rnd() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = terrain.sample(x, z);
        tries++;
      } while (
        tries < 12 &&
        ((terrain.water !== undefined && y < terrain.water + 1.2) ||
          (biome.snowLine !== undefined && y > biome.snowLine - 8))
      );

      const scale = 0.75 + rnd() * 0.9;
      const isPalm = biome.treeKind === "palm";
      const isConifer = biome.treeKind === "conifer";
      const trunkH = (isPalm ? 8.5 : isConifer ? 5.8 : 4.6) * scale;
      const trunkR = (isPalm ? 0.14 : isConifer ? 0.17 : 0.22) * scale;

      dummy.position.set(x, y + trunkH / 2, z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(trunkR, trunkH, trunkR);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.08, 0.28, 0.16 + rnd() * 0.06);
      trunks.setColorAt(i, color);

      const spread = isPalm ? 2.8 : isConifer ? 2.1 : 2.7;
      const baseY = y + trunkH;
      for (let b = 0; b < 3; b++) {
        const t = b / 2;
        const cy = baseY + (isConifer ? t * 2.1 * scale : b * 1.0 * scale);
        const cs =
          (isPalm
            ? 2.1 - t * 0.5
            : isConifer
              ? 1.65 - t * 0.55
              : 2.3 - Math.abs(t - 0.35) * 0.9) *
          scale *
          (0.9 + rnd() * 0.25);

        dummy.position.set(
          x + (rnd() - 0.5) * spread * 0.75 * scale,
          cy,
          z + (rnd() - 0.5) * spread * 0.75 * scale,
        );
        dummy.rotation.set(
          rnd() * 0.4 - 0.2,
          rnd() * Math.PI * 2,
          rnd() * 0.4 - 0.2,
        );
        dummy.scale.set(
          cs * (isPalm ? 1.6 : 1),
          cs * (isPalm ? 0.45 : isConifer ? 1.5 : 1.05),
          cs * (isPalm ? 1.6 : 1),
        );
        dummy.updateMatrix();
        canopies.setMatrixAt(ci, dummy.matrix);
        const h = isConifer ? 0.3 : 0.245;
        color.setHSL(h + rnd() * 0.03, 0.3 + rnd() * 0.18, 0.17 + rnd() * 0.1);
        canopies.setColorAt(ci, color);
        ci++;
      }
    }

    trunks.count = count;
    canopies.count = ci;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  }, [terrain, biome, count]);

  if (!count) return null;

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, undefined, count]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial roughness={0.92} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, undefined, canopyCount]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          roughness={0.86}
          metalness={0}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}
