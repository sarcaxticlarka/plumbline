import { CreateLogSchema } from "@/lib/domain/schema";
import * as repo from "@/lib/db/repo";
import { sealLog } from "@/lib/services";
import { configFromHeaders } from "@/lib/ai/config";
import { apiProject } from "@/lib/auth/guards";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await apiProject(req, id, "project.read");
    return json(repo.listLogs(id));
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { user } = await apiProject(req, id, "log.create");
    if (!rateLimit(`seal:${clientIp(req)}`, 20, 60_000)) return fail("Too many entries — slow down a moment.", 429);
    const input = CreateLogSchema.parse(await req.json());
    // Idempotent: a retried offline submission returns the entry it already created.
    const dupe = input.clientId ? repo.findLogByClientId(id, input.clientId) : null;
    if (dupe) return json({ entry: dupe, duplicate: true }, 200);
    const { entry, evaluation, note } = await sealLog(id, { ...input, authorId: user.id }, { cfg: configFromHeaders(req.headers) });
    return json({ entry, evidence: evaluation.evidence, note }, 201);
  } catch (e) {
    return handle(e);
  }
}
