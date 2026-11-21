"use client";

import { createContext, useContext } from "react";
import type { Terrain } from "@/lib/terrain";

export const TerrainCtx = createContext<Terrain | null>(null);

export function useTerrain(): Terrain {
  const t = useContext(TerrainCtx);
  if (!t) throw new Error("TerrainCtx missing");
  return t;
}
