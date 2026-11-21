import * as THREE from "three";
import { create } from "zustand";
import { BIOMES, isBiome, type BiomeId } from "./biomes";
import {
  KIT_MATERIALS,
  VEHICLES,
  isVehicle,
  type KitPart,
  type VehicleKind,
} from "./registry";
import { rig } from "./rig";
import { terrainRef } from "./terrainRef";

export type Weather = "clear" | "rain" | "snow";

export interface SpawnObject {
  id: string;
  name: string;
  kind: "kit" | "fetch";
  /** group origin (ground) */
  pos: [number, number, number];
  rot: number;
  parts?: KitPart[];
  q?: string;
  scale?: number;
}

export interface Teleport {
  id: number;
  x: number;
  z: number;
  peak?: boolean;
  heading?: number;
}

export interface WorldState {
  biome: BiomeId;
  heightMul: number;
  roughMul: number;
  hour: number;
  weather: Weather;
  rain: number;
  vehicle: { kind: VehicleKind; color: string } | null;
  driving: boolean;
  road: { curv: number; len: number } | null;
  objects: SpawnObject[];
  toast: { id: number; text: string } | null;
  teleport: Teleport | null;
  apply: (c: Record<string, unknown>) => string | null;
  setDriving: (v: boolean) => void;
  clearObjects: () => void;
}

let seq = 1;
const uid = () => `o${Date.now().toString(36)}${seq++}`;

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.min(hi, Math.max(lo, n));
};

const hex = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s))
    return (
      "#" +
      s
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return null;
};

function forwardVec(out = new THREE.Vector3()) {
  return out.set(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw));
}

function makePart(raw: unknown): KitPart | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const shapes = ["box", "cyl", "sph", "tor", "cone", "cap"] as const;
  const s = shapes.includes(p.s as never) ? (p.s as KitPart["s"]) : "box";
  const vec = (v: unknown, fallback?: number[]): number[] | undefined => {
    if (Array.isArray(v) && v.length >= 2) {
      return v.slice(0, 3).map((x) => Number(x) || 0);
    }
    return fallback;
  };
  const m = typeof p.m === "string" && p.m in KIT_MATERIALS ? p.m : "paint";
  const c = hex(p.c);
  return {
    s,
    p: vec(p.p, [0, 2, 8]),
    d: vec(p.d, [1, 1, 1]),
    r: vec(p.r),
    m,
    ...(c ? { c } : {}),
  };
}

function spawnFromPlayer(parts: KitPart[], name: string): SpawnObject {
  return {
    id: uid(),
    name,
    kind: "kit",
    pos: [rig.pos.x, rig.pos.y, rig.pos.z],
    rot: rig.yaw,
    parts,
  };
}

export const useWorld = create<WorldState>()((set, get) => ({
  biome: "grass",
  heightMul: 1,
  roughMul: 1,
  hour: 8.7,
  weather: "clear",
  rain: 0,
  vehicle: { kind: "sedan", color: VEHICLES.sedan.defaultColor },
  driving: false,
  road: null,
  objects: [],
  toast: null,
  teleport: null,

  clearObjects: () => set({ objects: [] }),

  setDriving: (v) => {
    if (!get().vehicle) return;
    rig.driving = v;
    if (v) {
      rig.speed = 0;
      rig.steer = 0;
    } else {
      const right = new THREE.Vector3(
        Math.cos(rig.yaw),
        0,
        -Math.sin(rig.yaw),
      );
      const x = rig.vehiclePos.x + right.x * 2.8;
      const z = rig.vehiclePos.z + right.z * 2.8;
      const y = terrainRef.current ? terrainRef.current.sample(x, z) : 0;
      rig.pos.set(x, y + 0.1, z);
      rig.pitch = 0;
      rig.vy = 0;
    }
    set({ driving: v });
  },

  apply: (cmd) => {
    if (!cmd || typeof cmd !== "object") return null;
    const c = cmd as Record<string, unknown>;
    const k = String(c.k ?? c.cmd ?? "").toLowerCase();
    const state = get();

    switch (k) {
      case "bio":
      case "biome": {
        const id = String(c.id ?? "").toLowerCase();
        if (!isBiome(id)) return null;
        const b = BIOMES[id];
        const hasH = typeof c.h === "number";
        set({
          biome: id,
          heightMul: hasH ? num(c.h, 1, 0.2, 8) : 1,
          roughMul: 1,
          objects: [],
          teleport: { id: Date.now() + seq, x: 0, z: 0 },
        });
        rig.speed = 0;
        return `World → ${b.label}`;
      }

      case "veh":
      case "vehicle": {
        const id = String(c.id ?? "").toLowerCase();
        if (!isVehicle(id)) return null;
        const def = VEHICLES[id];
        const color = hex(c.col) ?? state.vehicle?.color ?? def.defaultColor;
        const isFirst = state.vehicle === null;
        const enter = c.enter === true || state.driving;
        if (isFirst) {
          const f = forwardVec();
          rig.vehiclePos.set(
            rig.pos.x + f.x * 6,
            0,
            rig.pos.z + f.z * 6,
          );
          rig.heading = rig.yaw;
          rig.speed = 0;
        }
        set({ vehicle: { kind: id, color }, driving: enter });
        rig.driving = enter;
        if (enter) {
          rig.speed = 0;
          rig.steer = 0;
        }
        return `${def.label} · ${color}`;
      }

      case "col":
      case "color": {
        if (!state.vehicle) return null;
        const color = hex(c.v ?? c.col ?? c.c);
        if (!color) return null;
        set({ vehicle: { ...state.vehicle, color } });
        return `Paint → ${color}`;
      }

      case "env":
      case "environment": {
        const patch: Partial<WorldState> = {};
        if (c.tod !== undefined) patch.hour = num(c.tod, state.hour, 0, 24);
        const wx = String(c.wx ?? c.weather ?? "").toLowerCase();
        if (wx === "rain" || wx === "snow" || wx === "clear") {
          patch.weather = wx as Weather;
          patch.rain =
            wx === "clear"
              ? 0
              : num(c.rain, wx === "rain" ? 0.75 : 0.6, 0, 1);
        } else if (c.rain !== undefined) {
          const r = num(c.rain, state.rain, 0, 1);
          patch.rain = r;
          patch.weather = r > 0 ? ("rain" as Weather) : ("clear" as Weather);
        }
        if (Object.keys(patch).length === 0) return null;
        set(patch);
        const bits: string[] = [];
        if (patch.hour !== undefined)
          bits.push(
            `${String(Math.floor(patch.hour)).padStart(2, "0")}:${String(
              Math.round((patch.hour % 1) * 60),
            ).padStart(2, "0")}`,
          );
        if (patch.weather) bits.push(patch.weather);
        return bits.length ? `Sky → ${bits.join(" · ")}` : null;
      }

      case "terr":
      case "terrain": {
        const h = num(c.h, state.heightMul, 0.2, 8);
        const r = num(c.r, state.roughMul, 0.2, 4);
        set({ heightMul: h, roughMul: r, objects: [] });
        return `Terrain → x${h.toFixed(2)}`;
      }

      case "road": {
        const on = c.on !== false;
        if (!on) {
          set({ road: null });
          return "Road removed";
        }
        const curv = num(c.curv, 0.62, 0, 1);
        const len = num(c.len, 620, 160, 1400);
        set({ road: { curv, len } });
        return `Winding road · ${Math.round(len)}m`;
      }

      case "pos":
      case "position": {
        const at = String(c.at ?? "center").toLowerCase();
        if (at === "peak" || at === "mountain" || at === "summit") {
          set({ teleport: { id: Date.now() + seq, x: 0, z: 0, peak: true } });
          return "Moved → summit";
        }
        if (at === "road") {
          if (!state.road) set({ road: { curv: 0.62, len: 620 } });
          set({
            teleport: {
              id: Date.now() + seq,
              x: 0,
              z: 0,
              heading: 0,
            },
          });
          return "Moved → road";
        }
        set({ teleport: { id: Date.now() + seq, x: 0, z: 0 } });
        return "Moved → centre";
      }

      case "kit":
      case "spawn": {
        const raw = Array.isArray(c.parts) ? c.parts : [];
        const parts = raw
          .slice(0, 40)
          .map(makePart)
          .filter(Boolean) as KitPart[];
        if (!parts.length) return null;
        const obj = spawnFromPlayer(
          parts,
          String(c.name ?? c.n ?? "Object").slice(0, 48),
        );
        const objects = [...state.objects, obj].slice(-20);
        set({ objects });
        return `Spawned ${obj.name}`;
      }

      case "fetch": {
        const q = String(c.q ?? c.query ?? "").trim();
        if (!q) return null;
        const obj: SpawnObject = {
          id: uid(),
          name: q.slice(0, 48),
          kind: "fetch",
          pos: [rig.pos.x, rig.pos.y, rig.pos.z],
          rot: rig.yaw,
          q,
          scale: num(c.scale, 1, 0.05, 20),
        };
        set({ objects: [...state.objects, obj].slice(-20) });
        return `Fetching “${q}”…`;
      }

      case "clear": {
        set({ objects: [] });
        return "Scene cleared";
      }

      case "msg":
      case "say": {
        const text = String(c.t ?? c.text ?? "").slice(0, 160);
        if (!text) return null;
        set({ toast: { id: Date.now(), text } });
        return text;
      }

      default:
        return null;
    }
  },
}));

export function snapshot() {
  const s = useWorld.getState();
  return {
    mode: s.driving ? "driving" : "walking",
    veh: s.vehicle?.kind ?? null,
    col: s.vehicle?.color ?? null,
    biome: s.biome,
    tod: Math.round(s.hour),
    wx: s.weather,
    objs: s.objects.length,
    road: !!s.road,
  };
}
