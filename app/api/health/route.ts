export const runtime = "edge";

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      model: process.env.CEREBRAS_MODEL || "kimi-k3.1-pro",
      serverKey: !!process.env.CEREBRAS_API_KEY,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
