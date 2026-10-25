import { apiProject } from "@/lib/auth/guards";
import { integrity } from "@/lib/anchor/service";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await apiProject(req, id, "project.read");
    return json(integrity(id));
  } catch (e) {
    return handle(e);
  }
}
