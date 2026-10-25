import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guards";
import { acceptInvitesFor, getUserByEmail } from "@/lib/db/repo-auth";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
const Body = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });
let dummy: Promise<string> | null = null; // burn the same time for unknown emails so response timing doesn't reveal accounts

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { email, password } = Body.parse(await req.json());
    if (!rateLimit(`login:${clientIp(req)}:${email.toLowerCase()}`, 8, 60_000)) return fail("Too many attempts — wait a minute.", 429);
    const user = getUserByEmail(email);
    dummy ??= hashPassword("dummy-password");
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummy));
    if (!user || !ok) return fail("Email or password is incorrect.", 401);
    acceptInvitesFor(user);
    await startSession(user.id);
    return json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return handle(e);
  }
}
