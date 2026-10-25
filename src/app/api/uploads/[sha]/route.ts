import * as repo from "@/lib/db/repo";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!/^[a-f0-9]{64}$/.test(sha)) return fail("Not found", 404);
  const up = repo.getUpload(sha);
  if (!up) return fail("Not found", 404);
  return new Response(new Uint8Array(up.data), {
    headers: { "content-type": up.meta.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
