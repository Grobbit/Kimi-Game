# Kimi-Game

A photorealistic 3D world you edit by talking to it. You spawn in a grass field, walk around, hop into
vehicles, and type anything you want into a chat box in the corner — *"put me on a mountain"*,
*"now make the car blue"*, *"change it to an f1 car"* — and Kimi K3.1 Pro (Cerebras) turns that sentence
into a handful of engine commands that the running world applies instantly.

The model never writes code and never rebuilds graphics. It flips switches in a kit that already exists,
so every change stays at full fidelity and lands in a frame or two.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the page, paste a Cerebras API key in the gate screen (stored in your browser, sent only to the
local `/api/director` proxy), and press play.

To skip the key prompt, put one in `.env.local` on the server:

```bash
cp .env.example .env.local
# CEREBRAS_API_KEY=csk-...
```

Other optional vars (see `.env.example`): `CEREBRAS_BASE_URL`, `CEREBRAS_MODEL`,
`POLY_PIZZA_KEY` (Tier-2 asset search), `NEXT_PUBLIC_ASSET_BASE` (CDN for heavy GLB/HDRI assets).

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | walk |
| `Shift` | sprint |
| `Space` | jump |
| `F` | enter / exit the nearest vehicle |
| `W / S` | throttle / brake in a ground vehicle |
| `A / D` | steer |
| `Space / Ctrl` | climb / descend in a flying vehicle |
| `Tab` | open the director chat |

## Stack

- **Next.js 16** (App Router) + React 19, TypeScript
- **three.js** via `@react-three/fiber` / `drei`, post-processing with `n8ao` SSAO, bloom, SMAA, vignette
- **Rapier** (`@dimforge/rapier3d-compat`) for character + vehicle physics
- **zustand** for the world store
- Procedural everything: terrain from simplex noise, instanced grass/trees/rocks, sky shader, water,
  rain/snow — no asset downloads required to boot

## How the director works

```
Chat box → /api/director (edge route) → Cerebras chat completions (Kimi K3.1 Pro)
        ← {"c":[{"k":"veh","id":"f1","col":"#d11","enter":true}, …]}
        → store.applyCommands() → live scene
```

The system prompt is fully static (`lib/directorPrompt.ts`) so the provider can keep its KV cache warm;
world state is never interpolated into it. Commands are a closed, validated schema — biome, vehicle,
paint, time of day, weather, terrain scale, road, teleport — defined in `lib/registry.ts` and
`lib/biomes.ts`. Unknown commands are dropped rather than executed.

If no API key is reachable the app falls back to `lib/demoDirector.ts`, a small local keyword parser, so
the world is still drivable offline.

## Layout

```
app/                 page, layout, API routes (director, asset search, health)
components/          Boot, Gate, Game, HUD, Chat + scene/ (terrain, sky, grass, road, vehicles…)
lib/                 director prompt/client, registry, biomes, terrain, store, rig, incremental
```
