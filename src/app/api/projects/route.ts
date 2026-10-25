import { CreateProjectSchema } from "@/lib/domain/schema";
import * as repo from "@/lib/db/repo";
import { portfolio } from "@/lib/services";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const all = await portfolio();
    return json(all.map(({ events: _events, ...o }) => o));
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const input = CreateProjectSchema.parse(await req.json());
    return json(repo.insertProject({ ...input }), 201);
  } catch (e) {
    return handle(e);
  }
}
