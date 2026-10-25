import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { deleteSession, getUserById, insertSession, userForSession, type User } from "@/lib/db/repo-auth";
import { signToken, verifyToken } from "./token";
import { isDemoUserId } from "./demo";
import { demoEnabled } from "@/lib/api";

export const COOKIE = "plumbline_session";
const DAYS = 30;

/**
 * Two kinds of session:
 *  • stateless (signed cookie) — used when PLUMBLINE_SECRET is set, and, on serverless hosts, for the demo accounts
 *    (where each instance has its own throw-away disk, a database-backed session would vanish on the next request);
 *  • database-backed (random token, only its hash stored) — the default for self-hosted / persistent deployments.
 */
function statelessKey(): { key: Buffer; demoOnly: boolean } | null {
  const secret = process.env.PLUMBLINE_SECRET;
  if (secret && secret.length >= 16) return { key: createHash("sha256").update(secret).digest(), demoOnly: false };
  if ((process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) && demoEnabled()) {
    const seed = process.env.VERCEL_PROJECT_ID ?? process.env.VERCEL_URL ?? "plumbline";
    return { key: createHash("sha256").update(`plumbline-demo-fallback:${seed}`).digest(), demoOnly: true };
  }
  return null;
}

export async function startSession(userId: string) {
  const st = statelessKey();
  let token: string;
  if (st && (!st.demoOnly || isDemoUserId(userId))) token = signToken(userId, Date.now() + DAYS * 864e5, st.key);
  else {
    token = randomBytes(32).toString("base64url");
    insertSession(token, userId, DAYS);
  }
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && !token.startsWith("v1.")) deleteSession(token);
  jar.delete(COOKIE);
}

export async function sessionUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  if (!token.startsWith("v1.")) return userForSession(token);

  const st = statelessKey();
  const uid = st ? verifyToken(token, st.key) : null;
  if (!uid || (st!.demoOnly && !isDemoUserId(uid))) return null;
  let user = getUserById(uid);
  if (!user && demoEnabled() && isDemoUserId(uid)) {
    // A cold instance has an empty database: seed the demo workspace (deterministic ids), then look again.
    const { ensureSeed } = await import("@/lib/db/seed");
    await ensureSeed();
    user = getUserById(uid);
  }
  return user;
}
