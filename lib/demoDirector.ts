import { COLOR_NAMES, matchVehicle } from "./registry";
import { matchBiome } from "./biomes";

/**
 * Local fallback director used in demo mode (no API key) and as a
 * deterministic smoke-test harness. Maps plain language to the same command
 * JSON the model emits.
 */
export function demoDirector(message: string): {
  commands: Record<string, unknown>[];
  reply: string;
} {
  const t = message.toLowerCase();
  const cmds: Record<string, unknown>[] = [];

  /* ---- clearing ------------------------------------------------ */
  if (/(clear|remove) (everything|all|the scene)/.test(t) || t === "clear") {
    return { commands: [{ k: "clear" }], reply: "Cleared the scene." };
  }

  /* ---- world --------------------------------------------------- */
  const biome = matchBiome(t);
  if (biome) {
    cmds.push({ k: "bio", id: biome });
    if (biome === "alpine" || /peak|summit|top of/.test(t))
      cmds.push({ k: "pos", at: "peak" });
  }

  const roadWanted = /(winding road|road|track|highway|race track)/.test(t);
  if (roadWanted) {
    const curv = /(winding|twisty|curvy|serpentine)/.test(t) ? 0.78 : 0.5;
    cmds.push({ k: "road", on: true, curv, len: 700 });
  }

  /* ---- vehicle ------------------------------------------------- */
  const explicit =
    /(f1|formula)/.test(t)
      ? "f1"
      : /(helicopter|heli|chopper)/.test(t)
        ? "heli"
        : /(jet|fighter|airplane|plane)/.test(t)
          ? "jet"
          : /(truck|pickup|4x4)/.test(t)
            ? "truck"
            : /(sports car|supercar|ferrari|lambo|porsche)/.test(t)
              ? "sports"
              : matchVehicle(t);

  const wantsSeat =
    /(put me|get in|seat me|i want to|let me|take me|drive|sit|ride)/.test(t);
  const colorHex = findColor(t);
  const colorWord = colorHex !== null && /(blue|red|green|black|white|silver|yellow|orange|purple|pink|gold|teal|grey|gray)/.test(t);

  if (explicit && !(colorWord && /^(make|paint|turn)/.test(t) && !/car|vehicle/.test(t))) {
    const c: Record<string, unknown> = { k: "veh", id: explicit };
    if (colorHex) c.col = colorHex;
    if (wantsSeat || /put me/.test(t)) c.enter = true;
    cmds.push(c);
  } else if (colorHex && colorWord) {
    cmds.push({ k: "col", v: colorHex });
  }

  /* ---- weather / sky ------------------------------------------ */
  if (/(rain|storm|shower)/.test(t))
    cmds.push({ k: "env", wx: "rain", rain: /storm/.test(t) ? 1 : 0.7 });
  else if (/(snow|blizzard)/.test(t)) cmds.push({ k: "env", wx: "snow", rain: 0.65 });
  else if (/(clear sky|sunny|sunshine|no rain)/.test(t))
    cmds.push({ k: "env", wx: "clear" });

  if (/(night|midnight|dark)/.test(t)) cmds.push({ k: "env", tod: 22.5 });
  else if (/(sunset|dusk|golden hour|evening)/.test(t))
    cmds.push({ k: "env", tod: 18.8 });
  else if (/(noon|midday)/.test(t)) cmds.push({ k: "env", tod: 12 });
  else if (/morning/.test(t)) cmds.push({ k: "env", tod: 8 });

  /* ---- position ------------------------------------------------ */
  if (roadWanted) {
    cmds.push({ k: "pos", at: "road" });
    if (explicit && !cmds.some((c) => c.k === "veh"))
      cmds.push({ k: "veh", id: explicit, enter: true });
  } else if (biome === "alpine") {
    // peak teleport already queued
  } else if (/(put me|take me|teleport)/.test(t)) {
    cmds.push({ k: "pos", at: "center" });
  }

  /* ---- spawns -------------------------------------------------- */
  if (/(duck|rubber)/.test(t)) {
    cmds.push({
      k: "kit",
      name: "rubber duck",
      parts: [
        { s: "sph", p: [0, 2.6, 10], d: [4, 3.2, 5], m: "white" },
        { s: "sph", p: [0, 4.9, 8.4], d: [2.5, 2.5, 2.5], m: "white" },
        { s: "cone", p: [0, 4.8, 6.8], d: [1.1, 1.7, 1.1], r: [1.5708, 0, 0], m: "paint", c: "#f59e0b" },
      ],
    });
  } else if (/(piano)/.test(t)) {
    cmds.push({
      k: "kit",
      name: "grand piano",
      parts: [
        { s: "box", p: [0, 1.5, 9], d: [3.2, 0.7, 5], m: "paint", c: "#0b0b0d" },
        { s: "box", p: [0, 1.95, 9], d: [2.5, 0.14, 3.6], m: "white" },
        { s: "cyl", p: [-1.2, 0.7, 10.6], d: [0.14, 1.4, 0.14], m: "metal" },
        { s: "cyl", p: [1.2, 0.7, 10.6], d: [0.14, 1.4, 0.14], m: "metal" },
        { s: "cyl", p: [0, 0.7, 7.2], d: [0.14, 1.4, 0.14], m: "metal" },
      ],
    });
  } else if (/(castle|fortress)/.test(t)) {
    cmds.push({
      k: "kit",
      name: "stone castle",
      parts: [
        { s: "box", p: [0, 4, 16], d: [12, 8, 10], m: "concrete" },
        { s: "cyl", p: [-5.5, 7, 16], d: [2.2, 14, 2.2], m: "concrete" },
        { s: "cyl", p: [5.5, 7, 16], d: [2.2, 14, 2.2], m: "concrete" },
        { s: "cone", p: [-5.5, 16, 16], d: [3, 4, 3], m: "paint", c: "#7f1d1d" },
        { s: "cone", p: [5.5, 16, 16], d: [3, 4, 3], m: "paint", c: "#7f1d1d" },
      ],
    });
  } else if (/(monolith|obelisk)/.test(t)) {
    cmds.push({
      k: "kit",
      name: "monolith",
      parts: [
        { s: "box", p: [0, 8, 12], d: [3, 16, 2], m: "metal" },
        { s: "box", p: [0, 16.4, 12], d: [3.2, 0.4, 2.2], m: "gold" },
      ],
    });
  } else if (/(spawn|put|build|make|create|add)/.test(t)) {
    cmds.push({
      k: "kit",
      name: "sculpture",
      parts: [
        { s: "cyl", p: [0, 0.4, 10], d: [3, 0.8, 3], m: "marble" },
        { s: "tor", p: [0, 4.4, 10], d: [2.4, 0.5, 0], m: "gold" },
        { s: "sph", p: [0, 4.4, 10], d: [2, 2, 2], m: "chrome" },
      ],
    });
  }

  /* ---- terrain ------------------------------------------------- */
  if (/(bigger mountain|taller mountain|higher)/.test(t))
    cmds.push({ k: "terr", h: 1.8, r: 1.1 });

  const uniq = cmds.filter(
    (c, i) =>
      i ===
      cmds.findIndex(
        (d) => d.k === c.k && JSON.stringify(d) === JSON.stringify(c),
      ),
  );

  const reply = uniq.length
    ? "Directed."
    : "I can change the world, the sky, your ride, or spawn something.";
  return { commands: uniq, reply };
}

function findColor(t: string): string | null {
  const hex = t.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/);
  if (hex) return hex[0];
  const names = Object.keys(COLOR_NAMES).sort((a, b) => b.length - a.length);
  for (const n of names) {
    if (new RegExp(`\\b${n.replace(" ", "\\s")}\\b`).test(t)) {
      return COLOR_NAMES[n];
    }
  }
  return null;
}
