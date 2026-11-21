export type VehicleKind =
  | "sedan"
  | "sports"
  | "f1"
  | "truck"
  | "heli"
  | "jet";

export interface VehicleDef {
  id: VehicleKind;
  label: string;
  keywords: string[];
  maxSpeed: number; // m/s
  accel: number;
  brake: number;
  turn: number; // rad/s at full lock
  fly: boolean;
  /** camera follow distance */
  camDist: number;
  camHeight: number;
  /** vertical clearance of the chassis origin above ground */
  clearance: number;
  defaultColor: string;
}

export const VEHICLES: Record<VehicleKind, VehicleDef> = {
  sedan: {
    id: "sedan",
    label: "Sedan",
    keywords: ["sedan", "car", "vehicle", "auto", "saloon", "taxi"],
    maxSpeed: 34,
    accel: 9,
    brake: 18,
    turn: 1.7,
    fly: false,
    camDist: 8.2,
    camHeight: 3.1,
    clearance: 0,
    defaultColor: "#c9ced6",
  },
  sports: {
    id: "sports",
    label: "Sports Car",
    keywords: ["sports car", "supercar", "porsche", "ferrari", "lambo", "coupe"],
    maxSpeed: 52,
    accel: 15,
    brake: 26,
    turn: 2.0,
    fly: false,
    camDist: 7.6,
    camHeight: 2.6,
    clearance: 0,
    defaultColor: "#b3121b",
  },
  f1: {
    id: "f1",
    label: "F1 Car",
    keywords: ["f1", "formula", "race car", "open wheel", "grand prix"],
    maxSpeed: 72,
    accel: 22,
    brake: 34,
    turn: 2.6,
    fly: false,
    camDist: 8.6,
    camHeight: 2.5,
    clearance: 0,
    defaultColor: "#d81f2a",
  },
  truck: {
    id: "truck",
    label: "Pickup Truck",
    keywords: ["truck", "pickup", "4x4", "jeep", "offroad"],
    maxSpeed: 30,
    accel: 7,
    brake: 15,
    turn: 1.45,
    fly: false,
    camDist: 9.4,
    camHeight: 3.8,
    clearance: 0,
    defaultColor: "#3d4b5a",
  },
  heli: {
    id: "heli",
    label: "Helicopter",
    keywords: ["helicopter", "heli", "chopper", "rotor"],
    maxSpeed: 38,
    accel: 10,
    brake: 10,
    turn: 1.5,
    fly: true,
    camDist: 12,
    camHeight: 4.6,
    clearance: 0,
    defaultColor: "#243646",
  },
  jet: {
    id: "jet",
    label: "Jet",
    keywords: ["jet", "plane", "aircraft", "fighter", "airplane", "fly"],
    maxSpeed: 105,
    accel: 18,
    brake: 12,
    turn: 0.85,
    fly: true,
    camDist: 18,
    camHeight: 5.5,
    clearance: 0,
    defaultColor: "#5a6470",
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLES) as VehicleKind[];

export function isVehicle(v: unknown): v is VehicleKind {
  return typeof v === "string" && v in VEHICLES;
}

export function matchVehicle(text: string): VehicleKind | null {
  const t = text.toLowerCase();
  // most specific first
  const order: VehicleKind[] = ["f1", "heli", "jet", "sports", "truck", "sedan"];
  for (const id of order) {
    if (VEHICLES[id].keywords.some((k) => t.includes(k))) return id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Kitbash materials                                                  */
/* ------------------------------------------------------------------ */

export interface KitMaterial {
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat?: number;
  transmission?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export const KIT_MATERIALS: Record<string, KitMaterial> = {
  paint: { label: "paint", color: "#c8ccd4", metalness: 0.35, roughness: 0.28, clearcoat: 1 },
  gold: { label: "gold", color: "#d4a437", metalness: 1, roughness: 0.18 },
  chrome: { label: "chrome", color: "#e8edf2", metalness: 1, roughness: 0.06 },
  glass: { label: "glass", color: "#bfe4f5", metalness: 0.1, roughness: 0.04, transmission: 0.9 },
  marble: { label: "marble", color: "#e6e2da", metalness: 0.05, roughness: 0.25 },
  concrete: { label: "concrete", color: "#8d8d88", metalness: 0, roughness: 0.92 },
  wood: { label: "wood", color: "#7a5232", metalness: 0, roughness: 0.68 },
  neon: { label: "neon", color: "#0a0a0a", metalness: 0.2, roughness: 0.3, emissive: "#69f0ff", emissiveIntensity: 4 },
  rubber: { label: "rubber", color: "#17181a", metalness: 0, roughness: 0.95 },
  metal: { label: "metal", color: "#9aa3ad", metalness: 0.9, roughness: 0.32 },
  white: { label: "white", color: "#f2f4f7", metalness: 0.05, roughness: 0.4 },
};

export type KitShape = "box" | "cyl" | "sph" | "tor" | "cone" | "cap";

export interface KitPart {
  s: KitShape;
  /** position [right, up, forward] in metres, relative to the player */
  p?: number[];
  /** size [x, y, z] (torus: [radius, tube, 0]) */
  d?: number[];
  /** rotation in radians [x, y, z] */
  r?: number[];
  /** material id */
  m?: string;
  /** colour override */
  c?: string;
}

export const COLOR_NAMES: Record<string, string> = {
  red: "#e11d2e",
  crimson: "#a80f24",
  blue: "#1d4ed8",
  "light blue": "#38bdf8",
  cyan: "#22d3ee",
  green: "#16a34a",
  lime: "#84cc16",
  yellow: "#facc15",
  orange: "#f97316",
  purple: "#8b5cf6",
  violet: "#7c3aed",
  pink: "#ec4899",
  white: "#f5f7fa",
  black: "#111214",
  silver: "#c9ced6",
  grey: "#8a8f98",
  gray: "#8a8f98",
  gold: "#d4a437",
  teal: "#14b8a6",
  maroon: "#7f1d1d",
  brown: "#7c4a2d",
  rainbow: "#ff00aa",
};
