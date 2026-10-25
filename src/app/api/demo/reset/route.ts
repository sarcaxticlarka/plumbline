import { reseed } from "@/lib/db/seed";
import { apiUser } from "@/lib/auth/guards";
import { demoEnabled, fail, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!demoEnabled()) return fail("Demo mode is disabled.", 403);
    await apiUser(req);
    await reseed();
    return json({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
