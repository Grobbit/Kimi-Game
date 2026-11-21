import { PROVIDERS } from "@/lib/providers";

export const runtime = "edge";

export async function GET() {
  const serverKey = !!(
    process.env.DIRECTOR_API_KEY ||
    process.env.CEREBRAS_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
  return new Response(
    JSON.stringify({
      ok: true,
      providers: PROVIDERS.filter((p) => p.id !== "custom").map((p) => p.id),
      serverKey,
      defaultModel: process.env.DIRECTOR_MODEL || "kimi-k3.1-pro",
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
