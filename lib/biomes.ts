export type BiomeId = "grass" | "alpine" | "desert" | "coast";

export type TreeKind = "broad" | "conifer" | "palm" | "none";

export interface BiomeDef {
  id: BiomeId;
  label: string;
  keywords: string[];
  /** base terrain amplitude in metres */
  amp: number;
  /** base noise frequency */
  freq: number;
  ridge: boolean;
  terrace?: boolean;
  island?: boolean;
  /** vegetation */
  treeKind: TreeKind;
  treeCount: number;
  rockCount: number;
  grass: number;
  /** palette (sRGB hex) */
  groundLo: string;
  groundHi: string;
  dry: string;
  rock: string;
  snow?: string;
  sand?: string;
  snowLine?: number;
  /** fog density multiplier */
  fog: number;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  grass: {
    id: "grass",
    label: "Grass Field",
    keywords: [
      "grass",
      "field",
      "meadow",
      "plain",
      "prairie",
      "countryside",
      "park",
      "valley",
    ],
    amp: 16,
    freq: 0.009,
    ridge: false,
    treeKind: "broad",
    treeCount: 110,
    rockCount: 40,
    grass: 1,
    groundLo: "#3f5c28",
    groundHi: "#7d9448",
    dry: "#9a9455",
    rock: "#6f6a5c",
    fog: 1,
  },
  alpine: {
    id: "alpine",
    label: "Alpine Mountain",
    keywords: [
      "mountain",
      "alps",
      "alpine",
      "peak",
      "summit",
      "highland",
      "snowy",
      "cliff",
    ],
    amp: 430,
    freq: 0.0032,
    ridge: true,
    treeKind: "conifer",
    treeCount: 240,
    rockCount: 160,
    grass: 0.55,
    groundLo: "#4a6238",
    groundHi: "#6d7d4c",
    dry: "#8a8368",
    rock: "#70737a",
    snow: "#eef3f8",
    snowLine: 210,
    fog: 1.5,
  },
  desert: {
    id: "desert",
    label: "Desert Canyon",
    keywords: [
      "desert",
      "canyon",
      "dune",
      "sand",
      "wasteland",
      "arizona",
      "mesa",
      "badlands",
    ],
    amp: 95,
    freq: 0.0042,
    ridge: false,
    terrace: true,
    treeKind: "none",
    treeCount: 0,
    rockCount: 150,
    grass: 0.08,
    groundLo: "#b08a5e",
    groundHi: "#d8bd92",
    dry: "#c4a577",
    rock: "#8d6247",
    sand: "#dcc49a",
    fog: 1.15,
  },
  coast: {
    id: "coast",
    label: "Coastal Shore",
    keywords: [
      "beach",
      "coast",
      "ocean",
      "sea",
      "shore",
      "island",
      "tropical",
      "bay",
    ],
    amp: 34,
    freq: 0.0055,
    ridge: false,
    island: true,
    treeKind: "palm",
    treeCount: 90,
    rockCount: 50,
    grass: 0.8,
    groundLo: "#5f7c43",
    groundHi: "#93a05a",
    dry: "#b0a272",
    rock: "#75716a",
    sand: "#dbc9a0",
    fog: 1.1,
  },
};

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];

export function isBiome(v: unknown): v is BiomeId {
  return typeof v === "string" && v in BIOMES;
}

export function matchBiome(text: string): BiomeId | null {
  const t = text.toLowerCase();
  for (const b of Object.values(BIOMES)) {
    if (b.keywords.some((k) => t.includes(k))) return b.id;
  }
  return null;
}
