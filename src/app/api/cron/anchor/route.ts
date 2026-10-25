import { listProjects } from "@/lib/db/repo";
import { anchorProject } from "@/lib/anchor/service";
import { fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Daily job: anchor every project's chain head. Point any scheduler at it:
 *   curl -H "authorization: Bearer $CRON_SECRET" https://your-host/api/cron/anchor
 * Disabled (404) unless CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("Not found", 404);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Unauthorized", 401);
  const results = [];
  for (const p of listProjects()) {
    const o = await anchorProject(p.id, {});
    results.push({ project: p.id, created: o.created.length, skipped: o.skipped.length, errors: o.errors });
  }
  return json({ ok: true, results });
}
