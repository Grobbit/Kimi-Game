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

Open the page, paste an API key from any [OI]-compatible host (Cerebras, Moonshot/Kimi,
OpenRouter, Groq, DeepSeek, xAI, Together, Mistral, [OI], Anthropic, or your own endpoint), press
**Test key** to confirm which host owns it, then enter. The key is stored in your browser and sent
only to the local `/api/director` proxy.

To skip the key prompt, put one in `.env.local` on the server:

```bash
cp .env.example .env.local
# DIRECTOR_API_KEY=csk-...
# or CEREBRAS_API_KEY / MOONSHOT_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
```

Other optional vars (see `.env.example`): `DIRECTOR_BASE_URL`, `DIRECTOR_MODEL`,
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
Chat box → /api/director (edge route) → resolve host from the key → chat completions
        ← {"c":[{"k":"veh","id":"f1","col":"#d11","enter":true}, …]}
        → store.applyCommands() → live scene
```

**Any key, any host.** The route sanitises the pasted key (strips quotes, `Bearer `, newlines,
zero-width characters), orders candidate hosts by key prefix, then verifies with a real request —
first host that accepts it wins, and the winning provider/model is echoed back in
`x-director-provider` / `x-director-model` and persisted, so the next sentence skips discovery.
`GET /models` is used to pick a model when the host publishes one. Anthropic's wire format is
translated to [OI]-style SSE, so the client only ever parses one shape. `POST /api/key-test` is the
same logic behind the gate's **Test key** button.

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
