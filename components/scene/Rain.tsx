"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useWorld } from "@/lib/store";
import { rig } from "@/lib/rig";

const COUNT = 2400;

export default function Rain() {
  const weather = useWorld((s) => s.weather);
  const intensity = useWorld((s) => s.rain);
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);

  const geom = useMemo(() => {
    const pos = new Float32Array(COUNT * 2 * 3);
    let seed = 4321;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < COUNT; i++) {
      const x = (rnd() - 0.5) * 70;
      const y = rnd() * 34;
      const z = (rnd() - 0.5) * 70;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.05;
      pos[i * 6 + 4] = y - 0.75;
      pos[i * 6 + 5] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    if (weather !== "rain" || intensity <= 0.02) return;
    const g = group.current;
    if (!g) return;
    g.position.set(camera.position.x, 0, camera.position.z);
    const arr = geom.getAttribute("position").array as Float32Array;
    const fall = 26 * Math.min(delta, 0.05);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 6 + 1] -= fall;
      arr[i * 6 + 4] -= fall;
      if (arr[i * 6 + 4] < -2) {
        const y = 30 + Math.random() * 6;
        arr[i * 6 + 1] = y;
        arr[i * 6 + 4] = y - 0.75;
      }
    }
    geom.getAttribute("position").needsUpdate = true;
    void state;
    void rig;
  });

  if (weather !== "rain" || intensity <= 0.02) return null;

  return (
    <group ref={group}>
      <lineSegments geometry={geom} frustumCulled={false}>
        <lineBasicMaterial
          color="#b9d0e2"
          transparent
          opacity={0.2 + intensity * 0.28}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
