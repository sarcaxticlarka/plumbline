import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ROLES, can, isRole } from "@/lib/auth/permissions";

describe("passwords", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("role permissions", () => {
  it("encodes exactly who can do what", () => {
    expect(can("superintendent", "log.create")).toBe(true);
    expect(can("superintendent", "notice.send")).toBe(false); // drafts, but a PM sends
    expect(can("pm", "team.manage")).toBe(true);
    expect(can("pm", "notice.send")).toBe(true);
    expect(can("claims_reviewer", "log.create")).toBe(false); // reviewers can't add evidence
    expect(can("claims_reviewer", "anchor.create")).toBe(true);
    expect(can("owner_rep", "project.read")).toBe(true);
    for (const a of ["log.create", "notice.manage", "notice.send", "anchor.create", "team.manage", "export"] as const) expect(can("owner_rep", a), a).toBe(false);
    expect(can(null, "project.read")).toBe(false);
  });
  it("only accepts known roles", () => {
    expect(ROLES.every(isRole)).toBe(true);
    expect(isRole("admin")).toBe(false);
  });
});

describe("accounts, sessions and invites (real SQLite)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plumbline-auth-"));
  let a: typeof import("@/lib/db/repo-auth");
  let repo: typeof import("@/lib/db/repo");
  beforeAll(async () => {
    vi.stubEnv("PLUMBLINE_DB", path.join(dir, "a.db"));
    a = await import("@/lib/db/repo-auth");
    repo = await import("@/lib/db/repo");
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const project = () =>
    repo.insertProject({ name: "P", address: "", client: "", contractor: "", contractRef: "", ownerName: "", ownerEmail: "", lat: null, lon: null, rules: { preset: "x", delayNoticeDays: 7, changeNoticeDays: 7, differingConditionNoticeDays: 7 } });

  it("stores only a hash of the session token and expires it", () => {
    const u = a.createUser("Sam@Site.test", "Sam", "hash");
    expect(u.email).toBe("sam@site.test");
    a.insertSession("tok-abc", u.id, 30);
    expect(a.userForSession("tok-abc")?.id).toBe(u.id);
    expect(a.userForSession("tok-other")).toBeNull();
    const raw = JSON.stringify(a.getUserByEmail("sam@site.test"));
    expect(raw).not.toContain("tok-abc");
    a.insertSession("tok-old", u.id, -1);
    expect(a.userForSession("tok-old")).toBeNull();
    a.deleteSession("tok-abc");
    expect(a.userForSession("tok-abc")).toBeNull();
  });

  it("isolates projects: no membership, no role", () => {
    const p1 = project(), p2 = project();
    const u = a.createUser("m@site.test", "M", "h");
    a.setMember(p1.id, u.id, "superintendent");
    expect(a.roleOf(p1.id, u.id)).toBe("superintendent");
    expect(a.roleOf(p2.id, u.id)).toBeNull();
    expect(a.projectIdsFor(u.id).map((x) => x.projectId)).toEqual([p1.id]);
  });

  it("turns an invitation into a membership when that email signs up", () => {
    const p = project();
    const pm = a.createUser("pm@site.test", "PM", "h");
    a.setMember(p.id, pm.id, "pm");
    a.upsertInvite(p.id, "New.Person@Site.test", "claims_reviewer", pm.id);
    expect(a.listInvites(p.id)).toHaveLength(1);
    const joined = a.createUser("new.person@site.test", "New", "h");
    a.acceptInvitesFor(joined);
    expect(a.roleOf(p.id, joined.id)).toBe("claims_reviewer");
    expect(a.listInvites(p.id)).toHaveLength(0);
    expect(a.countPMs(p.id)).toBe(1);
  });
});
