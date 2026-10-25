import { apiProject } from "@/lib/auth/guards";
import { anchorProject, integrity } from "@/lib/anchor/service";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await apiProject(req, id, "project.read");
    return json(integrity(id));
  } catch (e) {
    return handle(e);
  }
}

/** Anchor the current chain head: RFC 3161 timestamp + email the fingerprint to the owner's rep. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { user } = await apiProject(req, id, "anchor.create");
    if (!rateLimit(`anchor:${clientIp(req)}`, 6, 60_000)) return fail("Slow down — too many anchor requests.", 429);
    const outcome = await anchorProject(id, { by: user.id });
    return json({ ...outcome, integrity: integrity(id) });
  } catch (e) {
    return handle(e);
  }
}
