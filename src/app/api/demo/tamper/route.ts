import * as repo from "@/lib/db/repo";
import { demoEnabled, fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Demo only: edits a sealed entry directly in SQLite, bypassing the application, then re-verifies. */
export async function POST(req: Request) {
  if (!demoEnabled()) return fail("Demo mode is disabled.", 403);
  const { projectId } = (await req.json()) as { projectId?: string };
  if (!projectId || !repo.getProject(projectId)) return fail("Project not found", 404);
  const t = repo.tamperWithLog(projectId);
  if (!t) return fail("Nothing to tamper with yet.", 409);
  return json({ tampered: t, chain: repo.verifyProjectChain(projectId) });
}
