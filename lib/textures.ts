"use client";

import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Ground detail                                                      */
/* ------------------------------------------------------------------ */

let groundCache: { map: THREE.Texture; normalMap: THREE.Texture } | null = null;

function hash2(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** seamless value noise over a 0..1 tile */
function vnoise(x: number, y: number, period: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(((xi % period) + period) % period, ((yi % period) + period) % period);
  const b = hash2(((xi + 1) % period + period) % period, ((yi % period) + period) % period);
  const c = hash2(((xi % period) + period) % period, ((yi + 1) % period + period) % period);
  const d = hash2(((xi + 1) % period + period) % period, ((yi + 1) % period + period) % period);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function tileableHeight(x: number, y: number) {
  return (
    0.45 * vnoise(x * 5, y * 5, 5) +
    0.32 * vnoise(x * 11, y * 11, 11) +
    0.23 * vnoise(x * 23, y * 23, 23)
  );
}

export function groundTextures() {
  if (groundCache) return groundCache;

  const S = 512;
  const color = document.createElement("canvas");
  color.width = S;
  color.height = S;
  const cc = color.getContext("2d")!;
  const img = cc.createImageData(S, S);
  const height = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const h = tileableHeight(x / S, y / S);
      height[i] = h;
      const v = 0.8 + (h - 0.5) * 0.18 + (Math.random() - 0.5) * 0.045;
      const g = Math.round(Math.min(1, Math.max(0, v)) * 240);
      img.data[i * 4] = g * 0.94;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g * 0.88;
      img.data[i * 4 + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0);

  // Normal map derived from the same height field (wrapped edges).
  const ncanvas = document.createElement("canvas");
  ncanvas.width = S;
  ncanvas.height = S;
  const nc = ncanvas.getContext("2d")!;
  const nimg = nc.createImageData(S, S);
  const at = (x: number, y: number) =>
    height[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 3.2;
      const len = Math.hypot(dx, dy, 1);
      nimg.data[i * 4] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 3] = 255;
    }
  }
  nc.putImageData(nimg, 0, 0);

  const map = new THREE.CanvasTexture(color);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(ncanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = 8;

  groundCache = { map, normalMap };
  return groundCache;
}

/* ------------------------------------------------------------------ */
/* Road                                                               */
/* ------------------------------------------------------------------ */

let roadTex: THREE.Texture | null = null;

export function asphaltTexture() {
  if (roadTex) return roadTex;
  const W = 256;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;

  x.fillStyle = "#2a2c2f";
  x.fillRect(0, 0, W, H);

  // aggregate
  const img = x.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const n = (Math.random() - 0.5) * 34;
    img.data[i * 4] = Math.max(0, Math.min(255, 42 + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, 44 + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, 47 + n));
  }
  x.putImageData(img, 0, 0);

  // subtle wear strips
  const grad = x.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.18)");
  grad.addColorStop(0.2, "rgba(0,0,0,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.035)");
  grad.addColorStop(0.8, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.18)");
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);

  // edge lines
  x.fillStyle = "rgba(232,232,226,0.72)";
  x.fillRect(W * 0.045, 0, 5, H);
  x.fillRect(W * 0.955 - 5, 0, 5, H);

  // dashed centre line
  x.fillStyle = "rgba(236,236,228,0.8)";
  for (let y = 0; y < H; y += 160) {
    x.fillRect(W / 2 - 3, y, 6, 90);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  roadTex = t;
  return t;
}
