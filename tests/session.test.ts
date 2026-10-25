import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { signToken, verifyToken } from "@/lib/auth/token";
import { DEMO_USERS, demoUserId, isDemoUserId } from "@/lib/auth/demo";

describe("stateless session tokens", () => {
  const key = randomBytes(32);
  it("verify on any instance that holds the key", () => {
    const t = signToken("u123abc", Date.now() + 60_000, key);
    expect(verifyToken(t, key)).toBe("u123abc");
  });
  it("reject tampering, wrong keys and expiry", () => {
    const t = signToken("u123abc", Date.now() + 60_000, key);
    expect(verifyToken(t.replace("u123abc", "uevil999"), key)).toBeNull(); // changed user id
    expect(verifyToken(t, randomBytes(32))).toBeNull(); // different key
    expect(verifyToken(t.slice(0, -2) + "xx", key)).toBeNull(); // mangled mac
    expect(verifyToken(signToken("u1", Date.now() - 1, key), key)).toBeNull(); // expired
    expect(verifyToken("not-a-token", key)).toBeNull();
    expect(verifyToken("v1.a.b", key)).toBeNull();
  });
});

describe("demo identities are identical on every instance", () => {
  it("derives ids from the email, deterministically", () => {
    expect(demoUserId("Maya@Northline.test")).toBe(demoUserId("maya@northline.test"));
    expect(new Set(DEMO_USERS.map((u) => demoUserId(u.email))).size).toBe(DEMO_USERS.length);
    expect(isDemoUserId(demoUserId("dev@northline.test"))).toBe(true);
    expect(isDemoUserId("u0000000")).toBe(false); // a signed cookie for a non-demo user is not honoured in demo-only mode
  });
});
