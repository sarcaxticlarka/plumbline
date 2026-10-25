import * as repo from "@/lib/db/repo";
import { apiProject } from "@/lib/auth/guards";
import { integrity } from "@/lib/anchor/service";
import { demoEnabled, fail, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Demo only: edits a sealed entry directly in SQLite, bypassing the application, then re-verifies. */
export async function POST(req: Request) {
  try {
    if (!demoEnabled()) return fail("Demo mode is disabled.", 403);
    const { projectId, mode } = (await req.json()) as { projectId?: string; mode?: "edit" | "rewrite" };
    if (!projectId) return fail("Project not found", 404);
    await apiProject(req, projectId, "project.read");
    const t = mode === "rewrite" ? repo.rewriteHistory(projectId) : repo.tamperWithLog(projectId);
    if (!t) return fail("Nothing to tamper with yet.", 409);
    return json({ tampered: t, mode: mode ?? "edit", integrity: integrity(projectId) });
  } catch (e) {
    return handle(e);
  }
}
