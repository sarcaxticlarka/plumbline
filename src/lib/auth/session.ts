import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { deleteSession, insertSession, userForSession, type User } from "@/lib/db/repo-auth";

export const COOKIE = "plumbline_session";
const DAYS = 30;

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  insertSession(token, userId, DAYS);
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
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}

export async function sessionUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? userForSession(token) : null;
}
