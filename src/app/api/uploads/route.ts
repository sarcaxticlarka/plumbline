import * as repo from "@/lib/db/repo";
import { apiUser } from "@/lib/auth/guards";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const PHOTO = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]);
// Browsers record to webm/ogg (Chrome/Firefox) or mp4 (Safari); allow codec parameters ("audio/webm;codecs=opus").
const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)(;.*)?$/;
const MAX_PHOTO = 8 * 1024 * 1024;
const MAX_AUDIO = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const user = await apiUser(req);
    if (!rateLimit(`upload:${clientIp(req)}:${user.id}`, 60, 60_000)) return fail("Too many uploads.", 429);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Attach a file under the field name 'file'.", 400);
    const isAudio = AUDIO.test(file.type);
    if (!isAudio && !PHOTO.has(file.type)) return fail("Only photos (JPEG, PNG, WebP, HEIC, GIF) and audio recordings can be attached.", 415);
    if (file.size > (isAudio ? MAX_AUDIO : MAX_PHOTO)) return fail(isAudio ? "Recordings must be 25 MB or smaller." : "Photos must be 8 MB or smaller.", 413);
    const mime = file.type.split(";")[0];
    const att = repo.saveUpload(Buffer.from(await file.arrayBuffer()), file.name.slice(0, 200), mime);
    return json(att, 201);
  } catch (e) {
    return handle(e);
  }
}
