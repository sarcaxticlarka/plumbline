import { clientIp, fail, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

/** City-level geocoding via Open-Meteo — enough to fetch site weather without any API key. */
export async function GET(req: Request) {
  if (!rateLimit(`geo:${clientIp(req)}`, 30, 60_000)) return fail("Too many lookups.", 429);
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return json([]);
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return json([]);
    const data = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
    return json(
      (data.results ?? []).map((r) => ({ label: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude })),
    );
  } catch {
    return json([]);
  }
}
