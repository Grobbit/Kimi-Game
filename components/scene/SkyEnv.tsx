"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Stars } from "@react-three/drei";
import SkyDome from "./SkyDome";
import { useWorld } from "@/lib/store";
import { BIOMES } from "@/lib/biomes";
import { rig } from "@/lib/rig";

function sunVector(hour: number) {
  const t = ((hour - 6) / 12) * Math.PI;
  return new THREE.Vector3(
    Math.cos(t) * 0.62,
    Math.sin(t),
    -0.48,
  ).normalize();
}

function mixHex(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();
}

export default function SkyEnv() {
  const hour = useWorld((s) => s.hour);
  const weather = useWorld((s) => s.weather);
  const biome = useWorld((s) => s.biome);
  const { scene, camera, gl } = useThree();

  useEffect(() => {
    (window as any).__three = { scene, camera, gl, mk: true };
  }, [scene, camera, gl]);

  const sun = useMemo(() => sunVector(hour), [hour]);
  const elevation = sun.y;

  const day = THREE.MathUtils.smoothstep(elevation, -0.02, 0.28);
  const golden =
    THREE.MathUtils.smoothstep(elevation, -0.08, 0.22) *
    (1 - THREE.MathUtils.smoothstep(elevation, 0.22, 0.55));

  const sunColor = mixHex("#ffb27a", "#fff3e2", Math.min(1, day * 1.15));
  const fogColor =
    weather === "rain"
      ? mixHex("#3b4652", "#8d9aa5", day)
      : mixHex("#0a1220", "#9dbad2", day);
  const fogDensity =
    BIOMES[biome].fog * (weather === "rain" ? 0.0034 : 0.00125);

  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const l = lightRef.current;
    if (l) l.target = target;
  }, [target]);

  useEffect(() => {
    const fog = new THREE.FogExp2(new THREE.Color(fogColor), fogDensity);
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = null;
    };
  }, [fogColor, fogDensity, scene]);

  useFrame(() => {
    const l = lightRef.current;
    if (!l) return;
    l.position.copy(rig.pos).addScaledVector(sun, 150);
    target.position.copy(rig.pos);
    target.updateMatrixWorld();
    // gently pull the camera far plane exposure with the sky
    if (camera instanceof THREE.PerspectiveCamera) {
      const want = weather === "rain" ? 0.55 : 0.9;
      // (tone mapping exposure is global; handled by renderer)
      void want;
    }
  });

  const night = elevation < 0.02;
  const shadows = day > 0.03;
  const cloud =
    weather === "rain" ? 0.95 : weather === "snow" ? 0.8 : night ? 0.12 : 0.22;

  return (
    <>
      <SkyDome
        sun={sun}
        elevation={elevation}
        golden={golden}
        day={day}
        cloud={cloud}
      />

      <hemisphereLight
        args={[mixHex("#0a1220", "#a9c6e4", day), "#3a3727", 0.16 + 0.34 * day]}
      />

      <directionalLight
        ref={lightRef}
        color={sunColor}
        intensity={0.06 + 4.2 * day}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />

      {night && (
        <Stars
          radius={420}
          depth={90}
          count={3600}
          factor={5.5}
          saturation={0}
          fade
          speed={0.35}
        />
      )}

      <Environment key={`env-${Math.round(day * 8)}-${Math.round(golden * 4)}`} resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.1 * day + 0.06}
          color={mixHex("#9fc4ee", "#eaf4ff", day)}
          scale={[900, 900, 1]}
          position={[0, 220, 0]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={0.32 * day + 0.02}
          color="#6b7358"
          scale={[900, 900, 1]}
          position={[0, -40, 0]}
          rotation-x={-Math.PI / 2}
        />
        <Lightformer
          form="circle"
          intensity={4.5 * day + 0.1}
          color={sunColor}
          scale={70}
          position={[sun.x * 160, sun.y * 160, sun.z * 160]}
        />
        <Lightformer
          form="rect"
          intensity={0.35 * day}
          color="#d8e6ff"
          scale={[200, 400, 1]}
          position={[-160, 80, -120]}
          rotation-y={Math.PI / 3}
        />
      </Environment>
    </>
  );
}
