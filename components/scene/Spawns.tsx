"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useWorld, type SpawnObject } from "@/lib/store";
import { KIT_MATERIALS, type KitPart } from "@/lib/registry";

function Part({ part }: { part: KitPart }) {
  const d = part.d ?? [1, 1, 1];
  const mat = KIT_MATERIALS[part.m ?? "paint"] ?? KIT_MATERIALS.paint;
  const color = part.c ?? mat.color;
  const p = part.p ?? [0, 1, 8];
  const r = part.r ?? [0, 0, 0];

  let geo: React.ReactNode;
  let scale: [number, number, number] = [1, 1, 1];

  switch (part.s) {
    case "cyl":
      geo = <cylinderGeometry args={[d[0] / 2, d[0] / 2, d[1] || 1, 32]} />;
      break;
    case "sph":
      geo = <sphereGeometry args={[0.5, 32, 24]} />;
      scale = [d[0] || 1, d[1] || 1, d[2] || 1];
      break;
    case "tor":
      geo = (
        <torusGeometry args={[d[0] / 2 || 0.5, d[1] / 2 || 0.1, 20, 56]} />
      );
      break;
    case "cone":
      geo = <coneGeometry args={[d[0] / 2 || 0.5, d[1] || 1, 32]} />;
      break;
    case "cap":
      geo = (
        <capsuleGeometry
          args={[d[0] / 2 || 0.5, Math.max(0.02, (d[1] || 1) - (d[0] || 1)), 8, 20]}
        />
      );
      break;
    default:
      geo = <boxGeometry args={[d[0] || 1, d[1] || 1, d[2] || 1]} />;
  }

  return (
    <mesh
      position={[p[0], p[1], -(p[2] ?? 8)]}
      rotation={[r[0] ?? 0, r[1] ?? 0, r[2] ?? 0]}
      scale={scale}
      castShadow
      receiveShadow
    >
      {geo}
      <meshPhysicalMaterial
        color={color}
        metalness={mat.metalness}
        roughness={mat.roughness}
        clearcoat={mat.clearcoat ?? 0}
        clearcoatRoughness={0.08}
        transmission={mat.transmission ?? 0}
        thickness={0.6}
        transparent={(mat.transmission ?? 0) > 0}
        emissive={mat.emissive ?? "#000000"}
        emissiveIntensity={mat.emissiveIntensity ?? 0}
        envMapIntensity={1.3}
      />
    </mesh>
  );
}

function Kitbash({ obj }: { obj: SpawnObject }) {
  return (
    <group position={obj.pos} rotation-y={obj.rot}>
      {obj.parts?.map((p, i) => <Part key={i} part={p} />)}
    </group>
  );
}

function LoadingOrb({ obj }: { obj: SpawnObject }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 1.6;
  });
  return (
    <group position={obj.pos} rotation-y={obj.rot}>
      <mesh ref={ref} position={[0, 2, -9]}>
        <torusGeometry args={[0.55, 0.045, 12, 60]} />
        <meshStandardMaterial
          color="#8fe6ff"
          emissive="#5edcff"
          emissiveIntensity={2.4}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function Fallback({ obj }: { obj: SpawnObject }) {
  return (
    <group position={obj.pos} rotation-y={obj.rot}>
      <group position={[0, 0, -9]}>
        <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.2, 1.35, 0.5, 40]} />
          <meshPhysicalMaterial
            color="#e6e2da"
            metalness={0.1}
            roughness={0.25}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <sphereGeometry args={[0.85, 40, 30]} />
          <meshPhysicalMaterial
            color="#dfe6ec"
            metalness={1}
            roughness={0.08}
            envMapIntensity={1.8}
          />
        </mesh>
      </group>
    </group>
  );
}

function Glb({
  url,
  obj,
}: {
  url: string;
  obj: SpawnObject;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!alive) return;
        const s = gltf.scene;
        const box = new THREE.Box3().setFromObject(s);
        const size = box.getSize(new THREE.Vector3());
        const max = Math.max(size.x, size.y, size.z) || 1;
        const target = 2.4 * (obj.scale ?? 1);
        s.scale.setScalar(target / max);
        const b2 = new THREE.Box3().setFromObject(s);
        s.position.y -= b2.min.y;
        s.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        setScene(s);
      },
      undefined,
      () => alive && setErr(true),
    );
    return () => {
      alive = false;
    };
  }, [url, obj.scale]);

  useEffect(() => {
    return () => {
      scene?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((x) => x?.dispose());
        }
      });
    };
  }, [scene]);

  if (err) return <Fallback obj={obj} />;
  if (!scene) return <LoadingOrb obj={obj} />;

  return (
    <group position={obj.pos} rotation-y={obj.rot}>
      <group position={[0, 0, -9]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function Fetched({ obj }: { obj: SpawnObject }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const q = obj.q ?? "";

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    fetch(`/api/assets/search?q=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const u = j?.results?.[0]?.url;
        if (typeof u === "string" && u.startsWith("http")) setUrl(u);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [q]);

  if (failed) return <Fallback obj={obj} />;
  if (!url) return <LoadingOrb obj={obj} />;
  return <Glb url={url} obj={obj} />;
}

export default function Spawns() {
  const objects = useWorld((s) => s.objects);
  return (
    <group>
      {objects.map((o) =>
        o.kind === "kit" ? (
          <Kitbash key={o.id} obj={o} />
        ) : (
          <Fetched key={o.id} obj={o} />
        ),
      )}
    </group>
  );
}
