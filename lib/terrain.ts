import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { BIOMES, type BiomeId } from "./biomes";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sstep(x: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface Terrain {
  biome: BiomeId;
  size: number;
  seg: number;
  step: number;
  heights: Float32Array;
  geometry: THREE.BufferGeometry;
  sample: (x: number, z: number) => number;
  normal: (x: number, z: number) => THREE.Vector3;
  maxPoint: { x: number; y: number; z: number };
  minY: number;
  maxY: number;
  water?: number;
}

const SIZE = 800;
const SEG = 240;

export function buildTerrain(
  biomeId: BiomeId,
  heightMul = 1,
  roughMul = 1,
): Terrain {
  const b = BIOMES[biomeId];
  const n1 = createNoise2D(mulberry32(1337));
  const n2 = createNoise2D(mulberry32(9137));
  const n3 = createNoise2D(mulberry32(4242));

  const amp = b.amp * heightMul;
  const freq = b.freq * (0.75 + roughMul * 0.35);

  const raw = (x: number, z: number) => {
    let h = 0;
    let a = 1;
    let f = freq;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      let v = n1(x * f, z * f);
      if (b.ridge) v = 1 - Math.abs(v);
      h += v * a;
      norm += a;
      a *= 0.52;
      f *= 2.07;
    }
    h /= norm;
    if (b.ridge) h = Math.pow(Math.max(0, h), 1.85);
    // broad landform
    h += n2(x * 0.0011, z * 0.0011) * 0.22;
    let y = h * amp;

    if (b.terrace) {
      const step = 13;
      y = y * 0.62 + Math.round(y / step) * step * 0.38;
    }
    if (b.island) {
      const d = Math.hypot(x, z);
      y -= sstep(d, 28, 300) * 150;
    }
    return y;
  };

  const n = SEG + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = -SIZE / 2 + j * (SIZE / SEG);
    for (let i = 0; i < n; i++) {
      const x = -SIZE / 2 + i * (SIZE / SEG);
      heights[j * n + i] = raw(x, z);
    }
  }

  // Coastal: lift the island so its crown sits just above sea level.
  let water: number | undefined;
  if (b.island) {
    const c = heights[(n >> 1) * n + (n >> 1)];
    const shift = 4.2 - c;
    for (let k = 0; k < heights.length; k++) heights[k] += shift;
    water = 1.5;
  }

  // Flatten the spawn bowl so the player and the car start on level ground.
  {
    const cH = heights[(n >> 1) * n + (n >> 1)];
    for (let j = 0; j < n; j++) {
      const z = -SIZE / 2 + j * (SIZE / SEG);
      for (let i = 0; i < n; i++) {
        const x = -SIZE / 2 + i * (SIZE / SEG);
        const k = (1 - sstep(Math.hypot(x, z), 7, 46)) * 0.92;
        const idx = j * n + i;
        heights[idx] += (cH - heights[idx]) * k;
      }
    }
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < heights.length; k++) {
    const y = heights[k];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const sample = (x: number, z: number) => {
    const fx = (x + SIZE / 2) / (SIZE / SEG);
    const fz = (z + SIZE / 2) / (SIZE / SEG);
    const i0 = Math.min(SEG - 1, Math.max(0, Math.floor(fx)));
    const j0 = Math.min(SEG - 1, Math.max(0, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i0));
    const tz = Math.min(1, Math.max(0, fz - j0));
    const h00 = heights[j0 * n + i0];
    const h10 = heights[j0 * n + i0 + 1];
    const h01 = heights[(j0 + 1) * n + i0];
    const h11 = heights[(j0 + 1) * n + i0 + 1];
    const a = h00 + (h10 - h00) * tx;
    const bb = h01 + (h11 - h01) * tx;
    return a + (bb - a) * tz;
  };

  const normal = (x: number, z: number) => {
    const e = 2.5;
    const hl = sample(x - e, z);
    const hr = sample(x + e, z);
    const hd = sample(x, z - e);
    const hu = sample(x, z + e);
    return new THREE.Vector3(hl - hr, 2 * e, hd - hu).normalize();
  };

  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  const index: number[] = [];

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = -SIZE / 2 + i * (SIZE / SEG);
      const z = -SIZE / 2 + j * (SIZE / SEG);
      positions[k * 3] = x;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = z;
      uvs[k * 2] = (i / SEG) * 34;
      uvs[k * 2 + 1] = (j / SEG) * 34;
    }
  }

  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * n + i;
      const bb = j * n + i + 1;
      const c = (j + 1) * n + i;
      const d = (j + 1) * n + i + 1;
      index.push(a, c, bb, bb, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;

  // ---- vertex colours ------------------------------------------------
  const lo = new THREE.Color(b.groundLo);
  const hi = new THREE.Color(b.groundHi);
  const dry = new THREE.Color(b.dry);
  const rock = new THREE.Color(b.rock);
  const snow = b.snow ? new THREE.Color(b.snow) : null;
  const sand = b.sand ? new THREE.Color(b.sand) : new THREE.Color("#d8c69b");
  const base = new THREE.Color();
  const tmp = new THREE.Color();

  let maxPoint = { x: 0, y: 0, z: 0 };
  const margin = 16; // keep peaks away from the world border

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = positions[k * 3];
      const y = positions[k * 3 + 1];
      const z = positions[k * 3 + 2];
      const slope = 1 - normals.getY(k);

      const v = n3(x * 0.022, z * 0.022) * 0.5 + 0.5;
      base.copy(lo).lerp(hi, v);

      // dry patches
      const dryMask = sstep(n3(x * 0.005 + 11, z * 0.005 - 7) * 0.5 + 0.5, 0.55, 0.95);
      base.lerp(dry, dryMask * 0.28);

      // fine mottling
      const mottle = n3(x * 0.16, z * 0.16) * 0.5 + 0.5;
      base.multiplyScalar(0.84 + mottle * 0.26);

      // exposed rock on steep faces
      base.lerp(rock, sstep(slope, 0.16, 0.46));

      if (snow && b.snowLine !== undefined) {
        const snowMask =
          sstep(y, b.snowLine, b.snowLine + 60) *
          (1 - sstep(slope, 0.25, 0.72));
        base.lerp(snow, snowMask);
      }

      if (water !== undefined) {
        const wet = 1 - sstep(y, water + 0.4, water + 2.6);
        base.lerp(sand, wet);
      }

      if (b.id === "desert") {
        base.lerp(sand, 0.35);
      }

      colors[k * 3] = base.r;
      colors[k * 3 + 1] = base.g;
      colors[k * 3 + 2] = base.b;

      if (
        i > margin &&
        i < n - margin &&
        j > margin &&
        j < n - margin &&
        y > maxPoint.y
      ) {
        maxPoint = { x, y, z };
      }
    }
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return {
    biome: biomeId,
    size: SIZE,
    seg: SEG,
    step: SIZE / SEG,
    heights,
    geometry,
    sample,
    normal,
    maxPoint,
    minY,
    maxY,
    water,
  };
}
