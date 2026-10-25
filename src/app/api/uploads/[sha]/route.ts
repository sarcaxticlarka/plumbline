import * as repo from "@/lib/db/repo";
import { apiUser } from "@/lib/auth/guards";
import { fail, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Serves photos and audio (with Range support, which Safari needs for <audio>). Sign-in required. */
export async function GET(req: Request, { params }: { params: Promise<{ sha: string }> }) {
  try {
    await apiUser(req);
    const { sha } = await params;
    if (!/^[a-f0-9]{64}$/.test(sha)) return fail("Not found", 404);
    const up = repo.getUpload(sha);
    if (!up) return fail("Not found", 404);
    const data = up.data;
    const headers: Record<string, string> = { "content-type": up.meta.mime, "accept-ranges": "bytes", "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" };
    const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start >= data.length || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${data.length}` } });
      return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${data.length}`, "content-length": String(end - start + 1) } });
    }
    return new Response(new Uint8Array(data), { headers: { ...headers, "content-length": String(data.length) } });
  } catch (e) {
    return handle(e);
  }
}
