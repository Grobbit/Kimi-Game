"use client";

import { useEffect, useMemo } from "react";
import { useWorld } from "@/lib/store";
import { buildTerrain } from "@/lib/terrain";
import { terrainRef } from "@/lib/terrainRef";
import { TerrainCtx } from "./terrainContext";
import TerrainMesh from "./TerrainMesh";
import SkyEnv from "./SkyEnv";
import Grass from "./Grass";
import Trees from "./Trees";
import Rocks from "./Rocks";
import Water from "./Water";
import Road from "./Road";
import Spawns from "./Spawns";
import Player from "./Player";
import VehicleRig from "./VehicleRig";
import Rain from "./Rain";

export default function World() {
  const biome = useWorld((s) => s.biome);
  const heightMul = useWorld((s) => s.heightMul);
  const roughMul = useWorld((s) => s.roughMul);

  const terrain = useMemo(() => {
    const t = buildTerrain(biome, heightMul, roughMul);
    terrainRef.current = t;
    return t;
  }, [biome, heightMul, roughMul]);

  useEffect(() => {
    terrainRef.current = terrain;
    return () => {
      terrain.geometry.dispose();
    };
  }, [terrain]);

  return (
    <TerrainCtx.Provider value={terrain}>
      <SkyEnv />
      <TerrainMesh />
      <Grass />
      <Trees />
      <Rocks />
      {terrain.water !== undefined && <Water />}
      <Road />
      <Spawns />
      <Player />
      <VehicleRig />
      <Rain />
    </TerrainCtx.Provider>
  );
}
