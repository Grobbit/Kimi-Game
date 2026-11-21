"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BIOMES } from "@/lib/biomes";
import { rig } from "@/lib/rig";
import { useTerrain } from "./terrainContext";

const MAX = 90000;

function makeTuft() {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const blade = (angle: number, ox: number, oz: number) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const segs = 3;
    const base = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = Math.pow(t, 0.85);
      const half = 0.03 * (1 - t * 0.94);
      const bend = t * t * 0.1;
      const lx = bend;
      const lz = -half;
      const rz = half;
      // rotate (x,z) around Y
      positions.push(lx * ca - lz * sa + ox, y, lx * sa + lz * ca + oz);
      positions.push(lx * ca - rz * sa + ox, y, lx * sa + rz * ca + oz);
      const shade = 0.48 + t * 0.62;
      colors.push(shade, shade, shade, shade, shade, shade);
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };

  blade(0, 0, 0);
  blade(1.257, 0.03, -0.015);
  blade(2.513, -0.025, 0.02);
  blade(3.77, 0.02, 0.025);
  blade(5.026, -0.03, -0.01);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Light the blades as if they were the ground: keeps the field from
  // reading as a pile of dark flat ribbons.
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  nrm.needsUpdate = true;
  return g;
}

export default function Grass() {
  const terrain = useTerrain();
  const biome = BIOMES[terrain.biome];
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const time = useMemo(() => ({ value: 0 }), []);
  const center = useRef(new THREE.Vector2(9999, 9999));

  const count = Math.max(600, Math.floor(MAX * biome.grass));
  const geom = useMemo(() => makeTuft(), []);

  useLayoutEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float wind = sin(uTime * 1.55 + iPos.x * 0.31 + iPos.z * 0.24) * 0.68
                      + sin(uTime * 2.9 + iPos.z * 0.58 + iPos.x * 0.12) * 0.26;
           float bendMask = position.y * position.y;
           transformed.x += wind * bendMask * 0.11;
           transformed.z += wind * bendMask * 0.07;`,
        );
    };
    m.customProgramCacheKey = () => "grass-wind-v1";
    m.needsUpdate = true;
  }, [time]);

  const place = (force: boolean) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (
      !force &&
      Math.hypot(rig.pos.x - center.current.x, rig.pos.z - center.current.y) < 18
    )
      return;
    center.current.set(rig.pos.x, rig.pos.z);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const R = 42;
    for (let i = 0; i < count; i++) {
      const r = R * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      const x = rig.pos.x + Math.cos(a) * r;
      const z = rig.pos.z + Math.sin(a) * r;
      const y = terrain.sample(x, z);
      const underwater =
        terrain.water !== undefined && y < terrain.water + 0.15;
      const nearCar =
        Math.abs(x - rig.vehiclePos.x) < 2.5 &&
        Math.abs(z - rig.vehiclePos.z) < 4.0;
      const s =
        underwater || nearCar || r < 0.8
          ? 0
          : 0.08 + rnd() * 0.12 + Math.max(0, 1 - r / R) * 0.06;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.8 + rnd() * 0.5), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const hue = 0.235 + rnd() * 0.05;
      const sat = 0.38 + rnd() * 0.2;
      const light = 0.3 + rnd() * 0.16;
      color.setHSL(hue, sat, light);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  useLayoutEffect(() => {
    center.current.set(9999, 9999);
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, count]);

  useFrame((state) => {
    time.value = state.clock.elapsedTime;
    if (!rig.driving && Math.random() < 0.12) place(false);
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geom, undefined, count]}
      frustumCulled={false}
      receiveShadow
      castShadow={false}
    >
      <meshStandardMaterial
        ref={matRef}
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.82}
        metalness={0}
      />
    </instancedMesh>
  );
}
