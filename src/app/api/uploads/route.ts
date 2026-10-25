import * as repo from "@/lib/db/repo";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX = 8 * 1024 * 1024;
const OK = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]);

export async function POST(req: Request) {
  try {
    if (!rateLimit(`upload:${clientIp(req)}`, 60, 60_000)) return fail("Too many uploads.", 429);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Attach a file under the field name 'file'.", 400);
    if (!OK.has(file.type)) return fail("Only photos (JPEG, PNG, WebP, HEIC, GIF) can be attached.", 415);
    if (file.size > MAX) return fail("Photos must be 8 MB or smaller.", 413);
    const att = repo.saveUpload(Buffer.from(await file.arrayBuffer()), file.name.slice(0, 200), file.type);
    return json(att, 201);
  } catch (e) {
    return handle(e);
  }
}
