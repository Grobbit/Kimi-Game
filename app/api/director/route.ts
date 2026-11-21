import { DIRECTOR_SYSTEM, RESPONSE_SCHEMA } from "@/lib/directorPrompt";
import {
  candidateProviders,
  pickModels,
  sanitizeKey,
  type ProviderDef,
} from "@/lib/providers";

export const runtime = "edge";

const MAX_ATTEMPTS = 18;
const DISCOVERY_TTL = 10 * 60 * 1000;

/** base url -> models, so we only pay for discovery once per instance. */
const discovery = new Map<string, { at: number; models: string[] }>();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function serverKey(): string {
  return sanitizeKey(
    process.env.DIRECTOR_API_KEY ||
      process.env.CEREBRAS_API_KEY ||
      process.env.MOONSHOT_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      "",
  );
}

function headersFor(p: ProviderDef, key: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (p.auth === "x-api-key") {
    h["x-api-key"] = key;
    if (p.wire === "anthropic") h["anthropic-version"] = "2023-06-01";
  } else {
    h.Authorization = "Bearer " + key;
  }
  if (p.id === "openrouter") {
    h["HTTP-Referer"] = "https://github.com/Grobbit/Kimi-Game";
    h["X-Title"] = "Kimi Game";
  }
  return h;
}

async function discoverModels(
  p: ProviderDef,
  base: string,
  key: string,
): Promise<string[] | null> {
  const cacheKey = `${p.id}:${base}:${key.slice(-6)}`;
  const hit = discovery.get(cacheKey);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL) return hit.models;
  try {
    const res = await fetch(`${base}/models`, {
      headers: headersFor(p, key),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body: any = await res.json();
    const ids: string[] = (body?.data ?? body?.models ?? [])
      .map((m: any) => (typeof m === "string" ? m : m?.id))
      .filter((m: unknown): m is string => typeof m === "string" && !!m);
    if (!ids.length) return null;
    discovery.set(cacheKey, { at: Date.now(), models: ids });
    return ids;
  } catch {
    return null;
  }
}

/** Payload shapes, cheapest-to-lose first: the engine wants JSON out of a chat model. */
function variantsFor(
  p: ProviderDef,
  model: string,
  state: string,
  message: string,
): Record<string, unknown>[] {
  const user = `S:${state}\nU:${message}`;

  if (p.wire === "anthropic") {
    return [
      {
        model,
        max_tokens: 420,
        temperature: 0.25,
        system: DIRECTOR_SYSTEM,
        messages: [{ role: "user", content: user }],
        stream: true,
      },
    ];
  }

  const common = {
    model,
    messages: [
      { role: "system", content: DIRECTOR_SYSTEM },
      { role: "user", content: user },
    ],
    stream: true,
    temperature: 0.25,
    top_p: 0.9,
    max_tokens: 420,
  };
  const usage = { include_usage: true };
  const schema = {
    type: "json_schema",
    json_schema: { name: "director", schema: RESPONSE_SCHEMA },
  };

  return [
    { ...common, reasoning_effort: "low", response_format: schema, stream_options: usage },
    { ...common, reasoning_effort: "low", response_format: { type: "json_object" }, stream_options: usage },
    { ...common, reasoning_effort: "low", stream_options: usage },
    { ...common, response_format: { type: "json_object" }, stream_options: usage },
    { ...common, response_format: schema },
    { ...common, stream_options: usage },
    { ...common },
  ];
}

/**
 * Anthropic streams its own event vocabulary. Translate it into the
 * [OI]-style `data: {"choices":[{"delta":{"content":"…"}}]}` chunks the
 * client already understands, so the rest of the app never learns about it.
 */
function anthropicToChatSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  let inTok = 0;
  let outTok = 0;

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      const emit = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let cut: number;
          while ((cut = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            const line = block
              .split("\n")
              .find((l) => l.trimStart().startsWith("data:"));
            if (!line) continue;
            const raw = line.slice(line.indexOf("data:") + 5).trim();
            if (!raw || raw === "[DONE]") continue;
            let j: any;
            try {
              j = JSON.parse(raw);
            } catch {
              continue;
            }
            if (j.type === "content_block_delta" && typeof j.delta?.text === "string") {
              emit({ choices: [{ delta: { content: j.delta.text } }] });
            } else if (j.type === "message_start") {
              inTok = j.message?.usage?.input_tokens ?? inTok;
              outTok = j.message?.usage?.output_tokens ?? outTok;
            } else if (j.type === "message_delta" && j.usage) {
              outTok = j.usage.output_tokens ?? outTok;
            }
          }
        }
        if (inTok || outTok) {
          emit({ choices: [{ delta: {} }], usage: { prompt_tokens: inTok, completion_tokens: outTok } });
        }
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch {
        /* client went away or upstream broke mid-stream */
      } finally {
        controller.close();
      }
    },
  });
}

function shorten(s: string, n = 150): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const key = sanitizeKey(req.headers.get("x-api-key")) || serverKey();

  if (!key) {
    return json(
      {
        error:
          "No API key. Paste one in the gate, or set DIRECTOR_API_KEY (or CEREBRAS_API_KEY / MOONSHOT_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY) on the server.",
      },
      401,
    );
  }

  const message = String(body?.message ?? "").slice(0, 800);
  if (!message) return json({ error: "Empty message." }, 400);

  let customBase = String(body?.baseUrl ?? "").trim();
  if (customBase) {
    try {
      const u = new URL(customBase);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
      customBase = u.toString().replace(/\/+$/, "");
    } catch {
      return json({ error: "Invalid API base URL." }, 400);
    }
  }

  const wantedModel = String(body?.model || process.env.DIRECTOR_MODEL || "")
    .trim()
    .slice(0, 120);
  const state =
    typeof body?.state === "object" && body.state
      ? JSON.stringify(body.state)
      : String(body?.state ?? "{}").slice(0, 600);

  const providers = candidateProviders({
    key,
    preferred: String(body?.provider ?? ""),
    customBase,
  }).filter((p) => (p.id === "custom" ? !!p.base : true));

  const attempts: { provider: string; model: string; status: number; detail: string }[] = [];
  let budget = MAX_ATTEMPTS;

  for (const p of providers) {
    if (budget <= 0) break;
    const base = p.base;

    const discovered = await discoverModels(p, base, key);
    const picks = pickModels({ provider: p, wanted: wantedModel, discovered });

    for (const pick of picks) {
      if (budget <= 0) break;
      const variants = variantsFor(p, pick.model, state, message);
      let keyRejected = false;

      for (const payload of variants) {
        if (budget <= 0) break;
        budget--;

        let res: Response;
        try {
          res = await fetch(`${base}/chat/completions`, {
            method: "POST",
            headers: headersFor(p, key),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45000),
          });
        } catch (e) {
          attempts.push({
            provider: p.label,
            model: pick.model,
            status: 0,
            detail: shorten((e as Error).message || "network error"),
          });
          break; // this host is unreachable; try the next one
        }

        if (res.ok && res.body) {
          const stream =
            p.wire === "anthropic" ? anthropicToChatSse(res.body) : res.body;
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "x-accel-buffering": "no",
              "x-director-provider": p.id,
              "x-director-model": pick.model,
              "x-director-base": base,
            },
          });
        }

        const detail = shorten(await res.text().catch(() => ""), 200);
        attempts.push({ provider: p.label, model: pick.model, status: res.status, detail });

        if (res.status === 401 || res.status === 403) {
          keyRejected = true;
          break; // wrong key for this host — move to the next provider
        }
        if (res.status === 404) break; // unknown model — next model for this host
        if (res.status === 429) break; // rate limited — next host
        if (res.status === 402 || res.status === 400) {
          // Bad payload shape OR an unavailable model. If the body names the
          // model, stop wasting variants on it.
          if (/model/i.test(detail) && !/response_format|reasoning|stream_options|top_p/i.test(detail)) {
            break;
          }
          continue; // otherwise: try the next variant
        }
        break;
      }

      if (keyRejected) break;
    }
  }

  // Nothing worked. Say exactly what each host said, without echoing the key.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const a of attempts) {
    const sig = `${a.provider}|${a.status}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    lines.push(`${a.provider}: ${a.status || "no response"} ${a.detail}`.trim());
  }

  const allAuth =
    attempts.length > 0 && attempts.every((a) => a.status === 401 || a.status === 403);
  const sawAuth = attempts.some((a) => a.status === 401 || a.status === 403);
  const looksCerebras = key.startsWith("csk");
  const hint = sawAuth
    ? allAuth
      ? ` Every host rejected this key as invalid${looksCerebras ? "" : " — note it does not start with csk-, so it is probably not a Cerebras key"}. Copy it again from the provider dashboard and check it has not expired.`
      : " At least one host rejected this key as invalid. Copy it again from the provider dashboard, or pick the provider manually under Advanced."
    : "";

  return json(
    {
      error: `Director could not reach a model.${hint} ${lines.slice(0, 4).join(" · ")}`.trim(),
      attempts: attempts.slice(0, 8),
    },
    allAuth ? 401 : 502,
  );
}
