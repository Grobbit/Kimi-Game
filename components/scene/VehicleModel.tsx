"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { rig } from "@/lib/rig";
import type { VehicleKind } from "@/lib/registry";

function Paint({ c }: { c: string }) {
  return (
    <meshPhysicalMaterial
      color={c}
      metalness={0.62}
      roughness={0.17}
      clearcoat={1}
      clearcoatRoughness={0.04}
      envMapIntensity={2.1}
      side={THREE.DoubleSide}
    />
  );
}

function Glass() {
  return (
    <meshPhysicalMaterial
      color="#0a151b"
      metalness={0.55}
      roughness={0.04}
      envMapIntensity={1.9}
      transparent
      opacity={0.86}
    />
  );
}

function Trim() {
  return <meshStandardMaterial color="#15171a" roughness={0.72} metalness={0.15} />;
}

function Chrome() {
  return <meshStandardMaterial color="#d9e0e7" metalness={1} roughness={0.16} />;
}

function Light({ c = "#fff4d6", i = 3 }: { c?: string; i?: number }) {
  return (
    <meshStandardMaterial
      color="#1a1a18"
      emissive={c}
      emissiveIntensity={i}
      roughness={0.3}
    />
  );
}

function Wheel({
  x,
  z,
  r = 0.34,
  w = 0.25,
  front = false,
}: {
  x: number;
  z: number;
  r?: number;
  w?: number;
  front?: boolean;
}) {
  const steer = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (spin.current) spin.current.rotation.x -= (rig.speed * dt) / r;
    if (front && steer.current) {
      const want = rig.driving ? rig.steer * 0.4 : 0;
      steer.current.rotation.y +=
        (want - steer.current.rotation.y) * Math.min(1, dt * 12);
    }
  });

  return (
    <group position={[x, r, z]} ref={steer}>
      <group ref={spin}>
        <mesh castShadow rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[r * 0.72, r * 0.72, w, 26]} />
          <meshStandardMaterial color="#0b0c0e" roughness={0.95} />
        </mesh>
        <mesh castShadow rotation-y={Math.PI / 2}>
          <torusGeometry args={[r * 0.8, r * 0.21, 12, 32]} />
          <meshStandardMaterial color="#111214" roughness={0.98} />
        </mesh>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[r * 0.54, r * 0.54, w * 1.03, 24]} />
          <Chrome />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            rotation-x={(i * Math.PI * 2) / 5}
            position={[0, 0, 0]}
          >
            <boxGeometry args={[w * 0.5, r * 0.95, 0.05]} />
            <Trim />
          </mesh>
        ))}
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[r * 0.13, r * 0.13, w * 1.1, 16]} />
          <Chrome />
        </mesh>
      </group>
    </group>
  );
}

function Sedan({ color }: { color: string }) {
  const body = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(2.0, 0.27);
    s.lineTo(-2.0, 0.27);
    s.lineTo(-2.2, 0.38);
    s.lineTo(-2.12, 0.83);
    s.lineTo(-1.72, 0.94);
    s.lineTo(-1.1, 1.34);
    s.lineTo(-0.35, 1.41);
    s.lineTo(0.52, 1.3);
    s.lineTo(1.35, 0.86);
    s.lineTo(2.2, 0.64);
    s.lineTo(2.2, 0.3);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 1.74,
      bevelEnabled: true,
      bevelSize: 0.045,
      bevelThickness: 0.05,
      bevelSegments: 3,
      steps: 1,
    });
    g.translate(0, 0, -0.87);
    g.rotateY(Math.PI / 2);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const taper = 1 - Math.max(0, y - 0.45) * 0.15;
      p.setX(i, p.getX(i) * taper);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={body} castShadow receiveShadow>
        <Paint c={color} />
      </mesh>

      {/* glass */}
      <mesh position={[0, 1.21, -0.62]} rotation-x={-0.72} castShadow>
        <boxGeometry args={[1.5, 0.02, 0.92]} />
        <Glass />
      </mesh>
      <mesh position={[0, 1.18, 1.5]} rotation-x={0.62} castShadow>
        <boxGeometry args={[1.42, 0.02, 0.72]} />
        <Glass />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 1.13, -0.02]}>
          <boxGeometry args={[0.015, 0.3, 1.62]} />
          <Glass />
        </mesh>
      ))}

      {/* wheel wells */}
      {[
        [-0.87, -1.42],
        [0.87, -1.42],
        [-0.87, 1.44],
        [0.87, 1.44],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.47, z]}>
          <boxGeometry args={[0.03, 0.46, 0.86]} />
          <Trim />
        </mesh>
      ))}

      {/* trim */}
      {[-0.94, 0.94].map((x) => (
        <mesh key={x} position={[x, 0.34, 0]} castShadow>
          <boxGeometry args={[0.06, 0.16, 2.9]} />
          <Trim />
        </mesh>
      ))}
      <mesh position={[0, 0.3, -2.2]} castShadow>
        <boxGeometry args={[1.86, 0.22, 0.12]} />
        <Trim />
      </mesh>
      <mesh position={[0, 0.3, 2.2]} castShadow>
        <boxGeometry args={[1.86, 0.22, 0.12]} />
        <Trim />
      </mesh>

      {/* grille + lights */}
      <mesh position={[0, 0.55, -2.22]}>
        <boxGeometry args={[0.95, 0.18, 0.03]} />
        <Trim />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.66, -2.2]}>
          <boxGeometry args={[0.42, 0.1, 0.035]} />
          <Light />
        </mesh>
      ))}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.7, 2.2]}>
          <boxGeometry args={[0.44, 0.11, 0.035]} />
          <Light c="#ff2a2a" i={2.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.52, 2.22]}>
        <boxGeometry args={[0.42, 0.1, 0.02]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.5} />
      </mesh>

      {/* mirrors + handles */}
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 1.02, -0.62]} castShadow>
          <boxGeometry args={[0.2, 0.1, 0.22]} />
          <Paint c={color} />
        </mesh>
      ))}
      {[-0.94, 0.94].map((x) => (
        <mesh key={x} position={[x, 0.78, 0.25]}>
          <boxGeometry args={[0.02, 0.035, 0.2]} />
          <Chrome />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.22, 2.24]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
          <Chrome />
        </mesh>
      ))}

      <Wheel x={-0.92} z={-1.42} r={0.36} w={0.26} front />
      <Wheel x={0.92} z={-1.42} r={0.36} w={0.26} front />
      <Wheel x={-0.92} z={1.44} r={0.36} w={0.26} />
      <Wheel x={0.92} z={1.44} r={0.36} w={0.26} />
    </group>
  );
}

function Sports({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox
        args={[1.96, 0.4, 4.4]}
        radius={0.14}
        smoothness={4}
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <RoundedBox
        args={[1.86, 0.22, 1.7]}
        radius={0.08}
        smoothness={3}
        position={[0, 0.72, -1.35]}
        castShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <RoundedBox
        args={[1.55, 0.44, 2.0]}
        radius={0.14}
        smoothness={4}
        position={[0, 0.86, 0.15]}
        castShadow
      >
        <Glass />
      </RoundedBox>
      <RoundedBox
        args={[1.36, 0.09, 1.5]}
        radius={0.05}
        smoothness={3}
        position={[0, 1.1, 0.35]}
        castShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <mesh position={[0, 0.24, -2.2]}>
        <boxGeometry args={[1.9, 0.12, 0.14]} />
        <Trim />
      </mesh>
      <mesh position={[0, 1.12, 2.03]} castShadow>
        <boxGeometry args={[1.7, 0.055, 0.36]} />
        <Paint c={color} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.92, 2.03]} castShadow>
          <boxGeometry args={[0.06, 0.28, 0.2]} />
          <Trim />
        </mesh>
      ))}
      {[-0.64, 0.64].map((x) => (
        <mesh key={x} position={[x, 0.58, -2.17]}>
          <boxGeometry args={[0.4, 0.1, 0.04]} />
          <Light />
        </mesh>
      ))}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.64, 2.17]}>
          <boxGeometry args={[0.44, 0.08, 0.04]} />
          <Light c="#ff2233" i={2.4} />
        </mesh>
      ))}
      <Wheel x={-0.9} z={-1.42} r={0.35} w={0.3} front />
      <Wheel x={0.9} z={-1.42} r={0.35} w={0.3} front />
      <Wheel x={-0.9} z={1.42} r={0.37} w={0.34} />
      <Wheel x={0.9} z={1.42} r={0.37} w={0.34} />
    </group>
  );
}

function F1({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox
        args={[0.88, 0.32, 3.3]}
        radius={0.12}
        smoothness={4}
        position={[0, 0.42, 0.1]}
        castShadow
        receiveShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <mesh
        position={[0, 0.46, -2.2]}
        rotation-x={-Math.PI / 2}
        castShadow
      >
        <coneGeometry args={[0.22, 1.5, 24]} />
        <Paint c={color} />
      </mesh>
      <RoundedBox
        args={[1.15, 0.16, 0.62]}
        radius={0.05}
        smoothness={3}
        position={[0, 0.24, -2.5]}
        castShadow
      >
        <Paint c={color} />
      </RoundedBox>
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x, 0.3, -2.5]} castShadow>
          <boxGeometry args={[0.05, 0.34, 0.62]} />
          <Paint c={color} />
        </mesh>
      ))}
      <RoundedBox
        args={[1.55, 0.07, 0.42]}
        radius={0.03}
        smoothness={3}
        position={[0, 1.02, 1.92]}
        castShadow
      >
        <Paint c={color} />
      </RoundedBox>
      {[-0.76, 0.76].map((x) => (
        <mesh key={x} position={[x, 1.0, 1.92]} castShadow>
          <boxGeometry args={[0.05, 0.42, 0.52]} />
          <Paint c={color} />
        </mesh>
      ))}
      <mesh position={[0, 0.74, 1.72]} castShadow>
        <boxGeometry args={[0.08, 0.5, 0.24]} />
        <Trim />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <RoundedBox
          key={x}
          args={[0.42, 0.36, 1.45]}
          radius={0.1}
          smoothness={3}
          position={[x, 0.44, 0.45]}
          castShadow
        >
          <Paint c={color} />
        </RoundedBox>
      ))}
      <RoundedBox
        args={[0.55, 0.42, 0.9]}
        radius={0.14}
        smoothness={3}
        position={[0, 0.78, 0.5]}
        castShadow
      >
        <Trim />
      </RoundedBox>
      <mesh position={[0, 0.98, 0.48]} castShadow>
        <sphereGeometry args={[0.17, 20, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.14, 0.32]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.43, 0.035, 10, 28]} />
        <Chrome />
      </mesh>
      <mesh position={[0, 0.9, 1.1]} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.42]} />
        <Paint c={color} />
      </mesh>
      {[
        [-0.86, -1.35, 0.34, 0.32],
        [0.86, -1.35, 0.34, 0.32],
        [-0.96, 1.38, 0.39, 0.44],
        [0.96, 1.38, 0.39, 0.44],
      ].map(([x, z, r, w], i) => (
        <Wheel
          key={i}
          x={x}
          z={z}
          r={r}
          w={w}
          front={z < 0}
        />
      ))}
      {[-0.62, 0.62].map((x) => (
        <mesh
          key={x}
          position={[x, 0.35, -1.35]}
          rotation-z={Math.PI / 2}
        >
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <Trim />
        </mesh>
      ))}
    </group>
  );
}

function Truck({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox
        args={[2.0, 0.62, 5.0]}
        radius={0.1}
        smoothness={3}
        position={[0, 0.78, 0]}
        castShadow
        receiveShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <RoundedBox
        args={[1.94, 1.0, 2.0]}
        radius={0.14}
        smoothness={4}
        position={[0, 1.5, -1.35]}
        castShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <mesh position={[0, 1.62, -2.34]}>
        <boxGeometry args={[1.62, 0.64, 0.05]} />
        <Glass />
      </mesh>
      {[-0.98, 0.98].map((x) => (
        <mesh key={x} position={[x, 1.62, -1.3]}>
          <boxGeometry args={[0.04, 0.56, 1.3]} />
          <Glass />
        </mesh>
      ))}
      <mesh position={[0, 2.02, -1.35]} castShadow>
        <boxGeometry args={[1.96, 0.08, 2.0]} />
        <Paint c={color} />
      </mesh>
      <mesh position={[0, 1.12, 0.75]} castShadow>
        <boxGeometry args={[1.9, 0.1, 2.5]} />
        <Trim />
      </mesh>
      {[-0.97, 0.97].map((x) => (
        <mesh key={x} position={[x, 1.28, 0.9]} castShadow>
          <boxGeometry args={[0.06, 0.44, 2.3]} />
          <Paint c={color} />
        </mesh>
      ))}
      <mesh position={[0, 1.28, 2.02]} castShadow>
        <boxGeometry args={[1.96, 0.44, 0.06]} />
        <Paint c={color} />
      </mesh>
      <mesh position={[0, 0.55, -2.5]}>
        <boxGeometry args={[2.04, 0.24, 0.16]} />
        <Chrome />
      </mesh>
      {[-0.68, 0.68].map((x) => (
        <mesh key={x} position={[x, 1.0, -2.36]}>
          <boxGeometry args={[0.46, 0.16, 0.04]} />
          <Light />
        </mesh>
      ))}
      <Wheel x={-0.95} z={-1.62} r={0.46} w={0.32} front />
      <Wheel x={0.95} z={-1.62} r={0.46} w={0.32} front />
      <Wheel x={-0.95} z={1.55} r={0.46} w={0.32} />
      <Wheel x={0.95} z={1.55} r={0.46} w={0.32} />
    </group>
  );
}

function Heli({ color }: { color: string }) {
  const rotor = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (rotor.current) rotor.current.rotation.y += (rig.driving ? 34 : 3.5) * dt;
    if (tail.current) tail.current.rotation.x += (rig.driving ? 60 : 8) * dt;
  });

  return (
    <group>
      <RoundedBox
        args={[1.75, 1.35, 3.2]}
        radius={0.45}
        smoothness={4}
        position={[0, 1.45, 0]}
        castShadow
        receiveShadow
      >
        <Paint c={color} />
      </RoundedBox>
      <mesh position={[0, 1.55, -1.35]} scale={[0.78, 0.7, 1.0]}>
        <sphereGeometry args={[1, 28, 20]} />
        <Glass />
      </mesh>
      <mesh
        position={[0, 1.5, 2.9]}
        rotation-x={Math.PI / 2}
        castShadow
      >
        <cylinderGeometry args={[0.22, 0.32, 3.4, 16]} />
        <Paint c={color} />
      </mesh>
      <mesh position={[0, 1.85, 4.4]} castShadow>
        <boxGeometry args={[0.08, 0.7, 0.9]} />
        <Paint c={color} />
      </mesh>
      <group ref={rotor} position={[0, 2.28, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.2, 0.22, 14]} />
          <Chrome />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation-y={(i * Math.PI) / 2} position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.17, 0.045, 5.6]} />
            <Trim />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0, 2.05, 4.55]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={(i * Math.PI) / 3}>
            <boxGeometry args={[0.05, 1.45, 0.1]} />
            <Trim />
          </mesh>
        ))}
      </group>
      {[-0.72, 0.72].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.16, 0]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.6, 10]} />
            <Chrome />
          </mesh>
          <mesh position={[x, 0.62, -0.7]} rotation-z={0.18}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
            <Chrome />
          </mesh>
          <mesh position={[x, 0.62, 0.7]} rotation-z={-0.18}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
            <Chrome />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.02, -1.75]}>
        <boxGeometry args={[0.5, 0.16, 0.04]} />
        <Light />
      </mesh>
    </group>
  );
}

function DeltaWing({
  color,
  span = 3.0,
  root = 3.0,
  tip = 1.1,
  sweep = 1.35,
  thickness = 0.09,
}: {
  color: string;
  span?: number;
  root?: number;
  tip?: number;
  sweep?: number;
  thickness?: number;
}) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -root / 2);
    s.lineTo(span, -tip / 2 - sweep);
    s.lineTo(span, tip / 2 - sweep);
    s.lineTo(0, root / 2);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.015,
      bevelSegments: 2,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -thickness / 2, 0);
    return g;
  }, [span, root, tip, sweep, thickness]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <Paint c={color} />
    </mesh>
  );
}

function Jet({ color }: { color: string }) {
  return (
    <group>
      <mesh
        position={[0, 1.55, 0.2]}
        rotation-x={Math.PI / 2}
        castShadow
        receiveShadow
      >
        <capsuleGeometry args={[0.56, 5.4, 12, 24]} />
        <Paint c={color} />
      </mesh>
      <mesh position={[0, 1.55, -3.15]} rotation-x={-Math.PI / 2} castShadow>
        <coneGeometry args={[0.56, 1.5, 24]} />
        <Paint c={color} />
      </mesh>
      <mesh position={[0, 1.92, -1.55]} scale={[0.48, 0.4, 1.15]}>
        <sphereGeometry args={[1, 28, 18]} />
        <Glass />
      </mesh>
      <group position={[0.45, 1.15, 0.35]}>
        <DeltaWing color={color} span={3.2} root={3.2} tip={1.0} sweep={1.5} />
      </group>
      <group position={[-0.45, 1.15, 0.35]} rotation-y={Math.PI}>
        <DeltaWing color={color} span={3.2} root={3.2} tip={1.0} sweep={1.5} />
      </group>
      <group position={[0.55, 2.05, 1.9]} rotation-z={Math.PI / 2}>
        <DeltaWing
          color={color}
          span={1.35}
          root={1.5}
          tip={0.55}
          sweep={0.55}
          thickness={0.07}
        />
      </group>
      <group position={[-0.55, 2.05, 1.9]} rotation-z={Math.PI / 2} rotation-y={Math.PI}>
        <DeltaWing
          color={color}
          span={1.35}
          root={1.5}
          tip={0.55}
          sweep={0.55}
          thickness={0.07}
        />
      </group>
      {[-0.85, 0.85].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.95, 0.55]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.3, 0.34, 2.4, 18]} />
            <Chrome />
          </mesh>
          <mesh position={[x, 0.95, 1.85]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.26, 0.26, 0.2, 16]} />
            <Light c="#ff8a3c" i={3.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.55, 2.75]} rotation-x={-Math.PI / 2}>
        <cylinderGeometry args={[0.34, 0.46, 0.5, 18]} />
        <Trim />
      </mesh>
    </group>
  );
}

export default function VehicleModel({
  kind,
  color,
}: {
  kind: VehicleKind;
  color: string;
}) {
  switch (kind) {
    case "sedan":
      return <Sedan color={color} />;
    case "sports":
      return <Sports color={color} />;
    case "f1":
      return <F1 color={color} />;
    case "truck":
      return <Truck color={color} />;
    case "heli":
      return <Heli color={color} />;
    case "jet":
      return <Jet color={color} />;
    default:
      return <Sedan color={color} />;
  }
}
