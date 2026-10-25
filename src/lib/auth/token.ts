import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless session token: `v1.<userId>.<expiresAtMs>.<hmac>`. Any server instance holding the key can verify it
 * with no database lookup — which is what makes sign-in work on serverless hosts, where each instance has its own
 * (ephemeral) disk and the next request usually lands on a different one.
 */
export function signToken(userId: string, expMs: number, key: Buffer): string {
  const body = `v1.${userId}.${expMs}`;
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function verifyToken(token: string, key: Buffer, now = Date.now()): string | null {
  const p = token.split(".");
  if (p.length !== 4 || p[0] !== "v1") return null;
  const [v, uid, exp, mac] = p;
  const want = createHmac("sha256", key).update(`${v}.${uid}.${exp}`).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(exp) > now ? uid : null;
}
