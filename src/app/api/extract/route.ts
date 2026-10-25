import { ExtractRequestSchema } from "@/lib/domain/schema";
import { previewExtraction } from "@/lib/services";
import { todayLocal } from "@/lib/domain/dates";
import { configFromHeaders } from "@/lib/ai/config";
import { apiProject, apiUser } from "@/lib/auth/guards";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Stateless live preview for the composer. Nothing is stored here. */
export async function POST(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get("project") ?? undefined;
    if (projectId) await apiProject(req, projectId, "log.create");
    else await apiUser(req);
    if (!rateLimit(`extract:${clientIp(req)}`, 40, 60_000)) return fail("Slow down — too many previews.", 429);
    const body = ExtractRequestSchema.parse(await req.json());
    const preview = await previewExtraction({
      transcript: body.transcript,
      logDate: body.logDate ?? todayLocal(),
      photos: body.photos,
      projectId,
      cfg: configFromHeaders(req.headers),
    });
    return json(preview);
  } catch (e) {
    return handle(e);
  }
}
