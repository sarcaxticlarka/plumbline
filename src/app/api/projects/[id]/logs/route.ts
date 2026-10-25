import { CreateLogSchema } from "@/lib/domain/schema";
import * as repo from "@/lib/db/repo";
import { sealLog } from "@/lib/services";
import { configFromHeaders } from "@/lib/ai/config";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!repo.getProject(id)) return fail("Project not found", 404);
  return json(repo.listLogs(id));
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!repo.getProject(id)) return fail("Project not found", 404);
    if (!rateLimit(`seal:${clientIp(req)}`, 20, 60_000)) return fail("Too many entries — slow down a moment.", 429);
    const input = CreateLogSchema.parse(await req.json());
    const { entry, evaluation, note } = await sealLog(id, input, { cfg: configFromHeaders(req.headers) });
    return json({ entry, evidence: evaluation.evidence, note }, 201);
  } catch (e) {
    return handle(e);
  }
}
