import * as repo from "@/lib/db/repo";
import { fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!repo.getProject(id)) return fail("Project not found", 404);
  return json(repo.verifyProjectChain(id));
}
