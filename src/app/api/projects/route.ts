import { CreateProjectSchema } from "@/lib/domain/schema";
import * as repo from "@/lib/db/repo";
import { setMember } from "@/lib/db/repo-auth";
import { portfolio } from "@/lib/services";
import { apiUser } from "@/lib/auth/guards";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await apiUser(req);
    const all = await portfolio(undefined, user.id);
    return json(all.map(({ events: _events, ...o }) => o));
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await apiUser(req);
    const input = CreateProjectSchema.parse(await req.json());
    const project = repo.insertProject({ ...input });
    setMember(project.id, user.id, "pm"); // whoever creates a project runs it
    return json(project, 201);
  } catch (e) {
    return handle(e);
  }
}
