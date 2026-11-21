/**
 * Provider registry + key handling for the director.
 *
 * The game only needs one thing from a model host: an [OI]-compatible
 * chat completion that streams text. That covers Cerebras, Moonshot/Kimi,
 * OpenRouter, Groq, DeepSeek, xAI, Together, Mistral, OpenAI and anything
 * self-hosted behind a custom base URL. Anthropic speaks a different wire
 * format, so it gets translated to [OI]-style SSE by the route.
 *
 * Keys are matched to providers by prefix first, then verified against
 * `GET /models` at request time — so a pasted key finds its home without the
 * player having to know which vendor it came from.
 */

export type Wire = "openai" | "anthropic";
export type AuthStyle = "bearer" | "x-api-key";

export interface ProviderDef {
  id: string;
  label: string;
  /** Base URL including the version segment, e.g. https://api.cerebras.ai/v1 */
  base: string;
  wire: Wire;
  auth: AuthStyle;
  /** Optional hint used to order candidates; never trusted on its own. */
  keyPattern?: RegExp;
  /** Ordered model preferences; discovery overrides this when it answers. */
  models: string[];
  priceIn: number;
  priceOut: number;
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "cerebras",
    label: "Cerebras",
    base: "https://api.cerebras.ai/v1",
    wire: "openai",
    auth: "bearer",
    keyPattern: /^csk[-_]/i,
    models: ["kimi-k3.1-pro", "kimi-k3", "qwen-3.8-27b", "gpt-oss-120b"],
    priceIn: 0.35,
    priceOut: 1.2,
    note: "Kimi K3.1 Pro needs a Dedicated Inference endpoint ID as the model.",
  },
  {
    id: "moonshot",
    label: "Moonshot · Kimi",
    base: "https://api.moonshot.ai/v1",
    wire: "openai",
    auth: "bearer",
    models: ["kimi-k3", "kimi-k2.6", "kimi-k2.7-code", "kimi-k2.5"],
    priceIn: 0.6,
    priceOut: 2.5,
  },
  {
    id: "kimi-code",
    label: "Kimi Code Plan",
    base: "https://api.kimi.com/coding/v1",
    wire: "openai",
    auth: "bearer",
    models: ["kimi-k3", "kimi-k2.6"],
    priceIn: 0.6,
    priceOut: 2.5,
  },
  {
    id: "moonshot-cn",
    label: "Moonshot (China)",
    base: "https://api.moonshot.cn/v1",
    wire: "openai",
    auth: "bearer",
    models: ["kimi-k3", "kimi-k2.6"],
    priceIn: 0.6,
    priceOut: 2.5,
    note: "Region-locked keys only.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    wire: "openai",
    auth: "bearer",
    keyPattern: /^sk-or-v1-/i,
    models: ["moonshotai/kimi-k3", "moonshotai/kimi-k2.6", "moonshotai/kimi-k2"],
    priceIn: 0.6,
    priceOut: 2.5,
  },
  {
    id: "groq",
    label: "Groq",
    base: "https://api.groq.com/openai/v1",
    wire: "openai",
    auth: "bearer",
    keyPattern: /^gsk_/i,
    models: ["moonshotai/kimi-k2-instruct", "llama-3.3-70b-versatile"],
    priceIn: 1.0,
    priceOut: 3.0,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    base: "https://api.deepseek.com/v1",
    wire: "openai",
    auth: "bearer",
    models: ["deepseek-chat"],
    priceIn: 0.28,
    priceOut: 0.42,
  },
  {
    id: "xai",
    label: "xAI",
    base: "https://api.x.ai/v1",
    wire: "openai",
    auth: "bearer",
    keyPattern: /^xai-/i,
    models: ["grok-4", "grok-3-mini"],
    priceIn: 3.0,
    priceOut: 15.0,
  },
  {
    id: "together",
    label: "Together",
    base: "https://api.together.xyz/v1",
    wire: "openai",
    auth: "bearer",
    models: ["moonshotai/Kimi-K2-Instruct"],
    priceIn: 1.0,
    priceOut: 3.0,
  },
  {
    id: "mistral",
    label: "Mistral",
    base: "https://api.mistral.ai/v1",
    wire: "openai",
    auth: "bearer",
    models: ["mistral-large-latest", "mistral-small-latest"],
    priceIn: 2.0,
    priceOut: 6.0,
  },
  {
    id: "openai",
    label: "OpenAI",
    base: "https://api.openai.com/v1",
    wire: "openai",
    auth: "bearer",
    keyPattern: /^sk-(proj|svcacct|admin)-/i,
    models: ["gpt-4.1-mini", "gpt-4o-mini"],
    priceIn: 0.4,
    priceOut: 1.6,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    base: "https://api.anthropic.com/v1",
    wire: "anthropic",
    auth: "x-api-key",
    keyPattern: /^sk-ant-/i,
    models: ["claude-sonnet-4-5", "claude-haiku-4-5"],
    priceIn: 3.0,
    priceOut: 15.0,
    note: "Translated to [OI]-style streaming by the director route.",
  },
  {
    id: "custom",
    label: "Custom endpoint",
    base: "",
    wire: "openai",
    auth: "bearer",
    models: [],
    priceIn: 0,
    priceOut: 0,
    note: "Any [OI]-compatible base URL.",
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export function getProvider(id: string | undefined | null): ProviderDef | undefined {
  if (!id) return undefined;
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * Strip everything a paste can drag along: smart quotes, zero-width joiners,
 * a leading "Bearer ", newlines from wrapped terminal output, and stray
 * whitespace in the middle of the key. Providers hash the literal bytes, so a
 * single invisible character is a 401.
 */
export function sanitizeKey(raw: unknown): string {
  let k = typeof raw === "string" ? raw : "";
  k = k.replace(/[\u200B-\u200F\uFEFF\u00A0]/g, " ");
  k = k.replace(/[\r\n\t]+/g, "");
  k = k.trim();
  k = k.replace(/^[`"']+|[`"']+$/g, "");
  k = k.replace(/^(bearer|token|api[_-]?key)\s*[:=]?\s+/i, "");
  k = k.replace(/[`"']/g, "");
  k = k.replace(/\s+/g, "");
  // NFKC last: it can expand exotic characters into something with spaces.
  k = k.normalize("NFKC").replace(/\s+/g, "");
  return k;
}

/** Cheap, non-authoritative guess used only to order the probe list. */
export function guessProvider(key: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.keyPattern?.test(key));
}

/**
 * Ordered list of providers to try for a key.
 *
 * - explicit provider first (then the auto list, so a stale choice still works)
 * - prefix matches next
 * - everything else after, in registry order
 */
export function candidateProviders(opts: {
  key: string;
  preferred?: string;
  customBase?: string;
}): ProviderDef[] {
  const { key, preferred, customBase } = opts;
  const out: ProviderDef[] = [];
  const push = (p?: ProviderDef) => {
    if (p && !out.some((o) => o.id === p.id)) out.push(p);
  };

  const pref = getProvider(preferred);
  if (pref?.id === "custom") {
    const base = (customBase || "").trim().replace(/\/+$/, "");
    if (base) push({ ...pref, base });
  } else if (pref) {
    push(pref);
  }

  const hinted = guessProvider(key);
  if (hinted && hinted.id !== "custom") push(hinted);

  for (const p of PROVIDERS) {
    if (p.id !== "custom") push(p);
  }

  return out;
}

/** True when the key looks like a Cerebras key but the model is not public. */
export function isDedicatedOnly(model: string): boolean {
  return /^kimi-k3(\.\d+)?(-pro)?$|^kimi-k2\.7-code$|^zai-glm-5\.3/.test(model);
}

export interface ModelPick {
  model: string;
  /** Where the choice came from, for the UI. */
  from: "requested" | "discovered" | "preset";
}

const KIMI_RANK = [
  /kimi-k3\.1-pro/i,
  /kimi-k3\b/i,
  /kimi-k2\.7/i,
  /kimi-k2\.6/i,
  /kimi-k2\.5/i,
  /kimi-k2/i,
  /kimi/i,
];

function rankModel(id: string): number {
  for (let i = 0; i < KIMI_RANK.length; i++) if (KIMI_RANK[i].test(id)) return i;
  return 100;
}

/**
 * Choose what to send as `model`. A requested id wins only if it is plausible
 * for the provider (in the discovered list, or no discovery available).
 */
export function pickModels(opts: {
  provider: ProviderDef;
  wanted?: string;
  discovered?: string[] | null;
  limit?: number;
}): ModelPick[] {
  const { provider, wanted, discovered } = opts;
  const limit = opts.limit ?? 3;
  const list: ModelPick[] = [];
  const seen = new Set<string>();
  const add = (model: string, from: ModelPick["from"]) => {
    const m = model.trim();
    if (!m || seen.has(m)) return;
    seen.add(m);
    list.push({ model: m, from });
  };

  const has = (m: string) => (discovered ?? []).includes(m);
  if (wanted && (!discovered || has(wanted))) add(wanted, "requested");

  if (discovered?.length) {
    for (const id of [...discovered].sort((a, b) => rankModel(a) - rankModel(b))) {
      add(id, "discovered");
    }
  }
  for (const id of provider.models) add(id, "preset");

  return list.slice(0, limit);
}
