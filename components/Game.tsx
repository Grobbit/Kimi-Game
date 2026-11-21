"use client";

import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import World from "./scene/World";
import PostFX from "./scene/PostFX";
import { initKeyboard } from "@/lib/keyboard";
import { useUI } from "@/lib/ui";

export default function Game() {
  const setBooted = useUI((s) => s.setBooted);

  useEffect(() => {
    const cleanup = initKeyboard();
    return cleanup;
  }, []);

  return (
    <div id="stage">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 61, near: 0.08, far: 3200, position: [0, 4, 14] }}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.toneMappingExposure = 1;
          setBooted(true);
        }}
      >
        <Suspense fallback={null}>
          <World />
        </Suspense>
        <PostFX />
      </Canvas>
    </div>
  );
}
