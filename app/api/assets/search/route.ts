export const runtime = "edge";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });

/**
 * Tier 2 of the asset pipeline: look up a ready-made GLB for objects that the
 * local pool doesn't cover. Uses Poly Pizza when POLY_PIZZA_KEY is set.
 * The client silently falls back to a kitbash sculpture when this returns [].
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return json({ results: [] });

  const key = process.env.POLY_PIZZA_KEY;
  if (!key) return json({ results: [], source: "none" });

  try {
    const res = await fetch(
      `https://api.poly.pizza/v1.1/search/${encodeURIComponent(q)}`,
      {
        headers: { "x-auth-token": key, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return json({ results: [], source: "error" });
    const data: any = await res.json();
    const rows: any[] = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
    const results = rows
      .slice(0, 4)
      .map((r) => ({
        id: r.ID ?? r.id ?? null,
        name: r.Title ?? r.title ?? q,
        url: r.Download ?? r.download ?? r.glb ?? null,
      }))
      .filter((r) => typeof r.url === "string" && r.url.startsWith("http"));
    return json({ results, source: "poly" });
  } catch {
    return json({ results: [], source: "error" });
  }
}
