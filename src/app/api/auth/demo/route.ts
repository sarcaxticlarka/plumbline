import { z } from "zod";
import { startSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guards";
import { getUserByEmail } from "@/lib/db/repo-auth";
import { DEMO_USERS, ensureSeed } from "@/lib/db/seed";
import { demoEnabled, fail, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One-click demo sign-in: only when PLUMBLINE_DEMO is on, and only for the seeded demo accounts. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!demoEnabled()) return fail("Demo sign-in is disabled.", 403);
    const { email } = z.object({ email: z.string().email() }).parse(await req.json());
    if (!DEMO_USERS.some((u) => u.email === email)) return fail("Not a demo account.", 403);
    await ensureSeed();
    const user = getUserByEmail(email);
    if (!user) return fail("Demo data isn’t seeded yet.", 409);
    await startSession(user.id);
    return json({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
