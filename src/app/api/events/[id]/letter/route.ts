import * as repo from "@/lib/db/repo";
import { generateNoticeLetter } from "@/lib/domain/letter";
import { todayLocal } from "@/lib/domain/dates";
import { apiProject } from "@/lib/auth/guards";
import { fail, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = repo.getEvent(decodeURIComponent(id));
    if (!found) return fail("Event not found", 404);
    await apiProject(req, found.project.id, "notice.manage");
    const { event, log, project } = found;
    return json(generateNoticeLetter({ project, event, log, today: todayLocal(), sealedHash: log.hash }));
  } catch (e) {
    return handle(e);
  }
}
