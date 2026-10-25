import { z } from "zod";
import { extract } from "@/lib/ai";
import { validateConfig, type AiConfig } from "@/lib/ai/config";
import { apiUser } from "@/lib/auth/guards";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.enum(["anthropic", "openai-compatible", "offline"]),
  apiKey: z.string().max(600).default(""),
  model: z.string().max(120).default(""),
  baseUrl: z.string().max(300).default(""),
});

const SAMPLE =
  "Wind picked up around ten. We had twelve ironworkers and eight carpenters on site. The crane was shut down for wind gusts, lost about four hours of steel hoisting.";

/** "Test connection": one tiny extraction with the visitor's credentials. Nothing is stored, nothing is logged. */
export async function POST(req: Request) {
  try {
    await apiUser(req);
    if (!rateLimit(`aitest:${clientIp(req)}`, 12, 60_000)) return fail("Too many tests — wait a minute.", 429);
    const cfg = Body.parse(await req.json()) as AiConfig;
    const problem = validateConfig(cfg);
    if (problem) return fail(problem, 422);
    const t0 = Date.now();
    try {
      const r = await extract(SAMPLE, undefined, cfg, { strict: true });
      return json({
        ok: true,
        engine: r.provider.name,
        model: r.provider.model,
        ms: Date.now() - t0,
        found: { events: r.extraction.events.length, manpower: r.extraction.manpower.reduce((s, m) => s + m.headcount, 0) },
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Connection failed", ms: Date.now() - t0 });
    }
  } catch (e) {
    return handle(e);
  }
}
