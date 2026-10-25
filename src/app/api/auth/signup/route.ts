import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guards";
import { acceptInvitesFor, createUser, getUserByEmail } from "@/lib/db/repo-auth";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
const Body = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!rateLimit(`signup:${clientIp(req)}`, 6, 3_600_000)) return fail("Too many sign-ups from this address — try later.", 429);
    const b = Body.parse(await req.json());
    if (getUserByEmail(b.email)) return fail("An account with that email already exists — sign in instead.", 409);
    const user = createUser(b.email, b.name, await hashPassword(b.password));
    acceptInvitesFor(user);
    await startSession(user.id);
    return json({ ok: true, user }, 201);
  } catch (e) {
    return handle(e);
  }
}
