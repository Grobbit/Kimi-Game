import {
  candidateProviders,
  pickModels,
  sanitizeKey,
  type ProviderDef,
} from "@/lib/providers";

export const runtime = "edge";

/**
 * "Does this key work, and where?" — used by the gate's Test button so a
 * player can find out before entering the world instead of after a 401.
 *
 * GET /models is free on every host we know, so it is the first probe; when a
 * host has no model list we fall back to a one-token completion.
 */

const DEADLINE_MS = 22000;
const PER_HOST_MS = 6000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function headersFor(p: ProviderDef, key: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (p.auth === "x-api-key") {
    h["x-api-key"] = key;
    if (p.wire === "anthropic") h["anthropic-version"] = "2023-06-01";
  } else {
    h.Authorization = "Bearer " + key;
  }
  return h;
}

function idsFrom(body: any): string[] {
  return (body?.data ?? body?.models ?? [])
    .map((m: any) => (typeof m === "string" ? m : m?.id))
    .filter((m: unknown): m is string => typeof m === "string" && !!m);
}

async function probe(
  p: ProviderDef,
  key: string,
  wanted: string,
): Promise<{ ok: boolean; status: number; models?: string[]; detail?: string }> {
  const base = p.base;
  let models: string[] | null = null;

  // Advisory only: some hosts (OpenRouter) publish the model list without
  // requiring a key, so a 200 here proves nothing about the key itself.
  try {
    const res = await fetch(`${base}/models`, {
      headers: headersFor(p, key),
      signal: AbortSignal.timeout(PER_HOST_MS),
    });
    if (res.ok) {
      models = idsFrom(await res.json().catch(() => ({})));
      if (!models.length) models = null;
    }
  } catch {
    /* fall through to the authoritative check */
  }

  // Authoritative: a one-shot completion. If this 200s, the key is real.
  const pick = pickModels({ provider: p, wanted, discovered: models })[0]?.model;
  if (!pick) return { ok: false, status: 404, detail: "no model to test" };

  const body =
    p.wire === "anthropic"
      ? { model: pick, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }
      : {
          model: pick,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
          stream: false,
        };

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: headersFor(p, key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PER_HOST_MS),
    });
    if (res.ok) return { ok: true, status: 200, models: models ?? undefined };
    return { ok: false, status: res.status, detail: (await res.text()).slice(0, 140) };
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message.slice(0, 140) };
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const key = sanitizeKey(body?.key);
  if (!key) return json({ ok: false, error: "Paste a key first." }, 400);

  const wanted = String(body?.model ?? "").trim();
  const customBase = String(body?.baseUrl ?? "").trim();
  const candidates = candidateProviders({
    key,
    preferred: String(body?.provider ?? ""),
    customBase,
  }).filter((p) => (p.id === "custom" ? !!p.base : true));

  const tried: { provider: string; status: number; detail?: string }[] = [];
  const started = Date.now();

  for (const p of candidates) {
    if (Date.now() - started > DEADLINE_MS) break;
    if (tried.length >= 6 && p.id !== "custom") break;

    const r = await probe(p, key, wanted);
    if (r.ok) {
      const picks = pickModels({ provider: p, wanted, discovered: r.models ?? null });
      return json({
        ok: true,
        provider: p.id,
        label: p.label,
        base: p.base,
        models: (r.models ?? p.models).slice(0, 60),
        model: picks[0]?.model ?? "",
        priceIn: p.priceIn,
        priceOut: p.priceOut,
        tried,
      });
    }
    tried.push({ provider: p.label, status: r.status, detail: r.detail });
  }

  const allAuth = tried.length > 0 && tried.every((t) => t.status === 401 || t.status === 403);
  return json(
    {
      ok: false,
      error: allAuth
        ? "No host accepted this key. Copy it again from your provider's dashboard (no spaces, no quotes) or choose the provider manually."
        : "Could not verify the key against any known host.",
      tried: tried.slice(0, 8),
    },
    allAuth ? 401 : 502,
  );
}
