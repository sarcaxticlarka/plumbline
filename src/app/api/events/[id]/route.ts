import { PatchEventSchema } from "@/lib/domain/schema";
import * as repo from "@/lib/db/repo";
import { apiProject } from "@/lib/auth/guards";
import { fail, handle, json } from "@/lib/api";
import { todayLocal } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = repo.getEvent(decodeURIComponent(id));
    if (!found) return fail("Event not found", 404);
    await apiProject(req, found.project.id, "notice.manage");
    const body = PatchEventSchema.parse(await req.json());
    const sentOn = body.noticeStatus === "sent" ? (body.noticeSentOn ?? todayLocal()) : null;
    repo.upsertNotice(found.event.id, found.project.id, body.noticeStatus, sentOn);
    return json(repo.getEvent(found.event.id)!.event);
  } catch (e) {
    return handle(e);
  }
}
