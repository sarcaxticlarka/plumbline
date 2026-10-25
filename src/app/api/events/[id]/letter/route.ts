import * as repo from "@/lib/db/repo";
import { generateNoticeLetter } from "@/lib/domain/letter";
import { todayLocal } from "@/lib/domain/dates";
import { fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = repo.getEvent(decodeURIComponent(id));
  if (!found) return fail("Event not found", 404);
  const { event, log, project } = found;
  return json(generateNoticeLetter({ project, event, log, today: todayLocal(), sealedHash: log.hash }));
}
