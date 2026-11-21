"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloud;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -1.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.4));

  // low horizon haze
  col = mix(col, uHorizon, pow(1.0 - clamp(h, 0.0, 1.0), 10.0) * 0.55);

  // sun disk + bloom halo
  float sd = max(dot(dir, normalize(uSun)), 0.0);
  col += uSunColor * pow(sd, 1400.0) * 9.0;
  col += uSunColor * pow(sd, 26.0) * 0.24;

  // cloud sheet projected on a plane above the horizon
  if (dir.y > 0.015) {
    vec2 uv = dir.xz / (dir.y + 0.16);
    float n = fbm(uv * 0.7 + vec2(uTime * 0.0035, uTime * 0.0012));
    float mask = smoothstep(0.52, 0.78, n) * smoothstep(0.02, 0.24, dir.y);
    float lit = smoothstep(-0.1, 0.6, dir.y);
    vec3 cloudCol = mix(vec3(0.52, 0.56, 0.62), uSunColor * 1.35 + 0.18, lit);
    col = mix(col, cloudCol, mask * uCloud);
  }

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function mixColor(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export default function SkyDome({
  sun,
  elevation,
  golden,
  day,
  cloud,
}: {
  sun: THREE.Vector3;
  elevation: number;
  golden: number;
  day: number;
  cloud: number;
}) {
  const night = 1 - THREE.MathUtils.smoothstep(elevation, -0.22, 0.03);

  const uniforms = useMemo(() => {
    const dayZenith = new THREE.Color("#2a6aa8");
    const nightZenith = new THREE.Color("#04070f");
    const goldenZenith = new THREE.Color("#395a86");
    const zenith = dayZenith.clone().lerp(nightZenith, night).lerp(goldenZenith, golden * 0.7);

    const dayHorizon = new THREE.Color("#c4dcee");
    const nightHorizon = new THREE.Color("#0c1522");
    const goldenHorizon = new THREE.Color("#efae7d");
    const horizon = dayHorizon.clone().lerp(nightHorizon, night).lerp(goldenHorizon, golden * 0.8);

    return {
      uZenith: { value: zenith },
      uHorizon: { value: horizon },
      uSun: { value: sun.clone() },
      uSunColor: { value: mixColor("#ffb077", "#fff2dd", Math.min(1, day * 1.2)) },
      uTime: { value: 0 },
      uCloud: { value: cloud },
    };
  }, [sun, night, golden, day, cloud]);

  const ref = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    if (ref.current) ref.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh scale={2400} renderOrder={-5} frustumCulled={false}>
      <sphereGeometry args={[1, 40, 24]} />
      <shaderMaterial
        ref={ref}
        args={[{
          uniforms,
          vertexShader: VERT,
          fragmentShader: FRAG,
          side: THREE.BackSide,
          depthWrite: false,
          depthTest: true,
          toneMapped: true,
        }]}
      />
    </mesh>
  );
}
