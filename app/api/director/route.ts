import { DIRECTOR_SYSTEM, RESPONSE_SCHEMA } from "@/lib/directorPrompt";

export const runtime = "edge";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const key =
    req.headers.get("x-api-key")?.trim() ||
    process.env.CEREBRAS_API_KEY?.trim() ||
    "";

  if (!key) {
    return json(
      {
        error:
          "No Kimi API key. Paste one in settings, or set CEREBRAS_API_KEY on the server.",
      },
      401,
    );
  }

  const message = String(body?.message ?? "").slice(0, 800);
  if (!message) return json({ error: "Empty message." }, 400);

  let base = String(
    body?.baseUrl || process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1",
  ).replace(/\/+$/, "");
  try {
    const u = new URL(base);
    if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
    base = u.toString().replace(/\/+$/, "");
  } catch {
    return json({ error: "Invalid API base URL." }, 400);
  }

  const model = String(
    body?.model || process.env.CEREBRAS_MODEL || "kimi-k3.1-pro",
  ).slice(0, 80);

  const state =
    typeof body?.state === "object" && body.state
      ? JSON.stringify(body.state)
      : String(body?.state ?? "{}").slice(0, 600);

  const messages = [
    { role: "system", content: DIRECTOR_SYSTEM },
    { role: "user", content: `S:${state}\nU:${message}` },
  ];

  const common = {
    model,
    messages,
    stream: true,
    temperature: 0.25,
    top_p: 0.9,
    max_tokens: 420,
  };

  const variants: Record<string, unknown>[] = [
    {
      ...common,
      reasoning_effort: "none",
      stream_options: { include_usage: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: "director", schema: RESPONSE_SCHEMA },
      },
    },
    {
      ...common,
      reasoning_effort: "none",
      stream_options: { include_usage: true },
      response_format: { type: "json_object" },
    },
    {
      ...common,
      reasoning_effort: "none",
      stream_options: { include_usage: true },
    },
    { ...common, stream_options: { include_usage: true } },
    { ...common, response_format: { type: "json_object" } },
    common,
  ];

  let lastErr = "";
  let lastStatus = 502;

  for (const payload of variants) {
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      lastErr = (e as Error).message;
      lastStatus = 502;
      continue;
    }

    if (res.ok && res.body) {
      return new Response(res.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    }

    lastErr = await res.text().catch(() => "");
    lastStatus = res.status;

    // Auth / model errors won't be fixed by changing the payload shape.
    if (res.status === 401 || res.status === 403 || res.status === 404) break;
  }

  return json(
    {
      error: `Cerebras error ${lastStatus}: ${lastErr.slice(0, 400) || "unknown"}`,
    },
    502,
  );
}
