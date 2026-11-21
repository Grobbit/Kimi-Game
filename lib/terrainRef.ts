import type { Terrain } from "./terrain";

/** Latest generated terrain. Written by the Terrain component during render. */
export const terrainRef: { current: Terrain | null } = { current: null };
