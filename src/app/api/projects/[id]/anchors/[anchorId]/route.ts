import { apiProject } from "@/lib/auth/guards";
import { getAnchor } from "@/lib/db/repo";
import { fail, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Download the raw RFC 3161 timestamp response (.tsr) so anyone can verify it with OpenSSL, independent of Plumbline. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; anchorId: string }> }) {
  try {
    const { id, anchorId } = await params;
    await apiProject(req, id, "export");
    const a = getAnchor(anchorId);
    if (!a || a.projectId !== id || a.kind !== "rfc3161" || typeof a.detail.tsrBase64 !== "string") return fail("Not found", 404);
    return new Response(new Uint8Array(Buffer.from(a.detail.tsrBase64, "base64")), {
      headers: { "content-type": "application/timestamp-reply", "content-disposition": `attachment; filename="anchor-${a.headSeq}.tsr"` },
    });
  } catch (e) {
    return handle(e);
  }
}
