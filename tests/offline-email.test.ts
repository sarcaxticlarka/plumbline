import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RICH_DAY } from "./fixtures";

describe("offline capture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plumbline-off-"));
  let repo: typeof import("@/lib/db/repo");
  let svc: typeof import("@/lib/services");
  let ev: typeof import("@/lib/domain/events");
  let pid = "";

  beforeAll(async () => {
    vi.stubEnv("PLUMBLINE_DB", path.join(dir, "o.db"));
    vi.stubEnv("PLUMBLINE_SEED", "0");
    repo = await import("@/lib/db/repo");
    svc = await import("@/lib/services");
    ev = await import("@/lib/domain/events");
    pid = repo.insertProject({ name: "O", address: "", client: "", contractor: "", contractRef: "", ownerName: "", ownerEmail: "", lat: null, lon: null, rules: { preset: "x", delayNoticeDays: 7, changeNoticeDays: 7, differingConditionNoticeDays: 7 } }).id;
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("accepts a device clock only when it is plausible", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    expect(svc.saneCapturedAt("2026-10-25T09:00:00Z", now)).toBe(true);
    expect(svc.saneCapturedAt("2026-10-26T09:00:00Z", now)).toBe(false); // future
    expect(svc.saneCapturedAt("2026-08-01T09:00:00Z", now)).toBe(false); // older than 30 days
    expect(svc.saneCapturedAt("not a date", now)).toBe(false);
    expect(svc.saneCapturedAt(undefined, now)).toBe(false);
  });

  it("scores contemporaneity from when it was dictated, not when the signal came back", async () => {
    // Dictated on the day (device clock), synced two days later.
    const { entry } = await svc.sealLog(
      pid,
      { logDate: "2026-10-23", author: "M", transcript: RICH_DAY, source: "voice", attachments: [], addendumOf: null, capturedAt: "2026-10-23T09:00:00.000Z", clientId: "client-offline-1" },
      { forceLocal: true, createdAt: "2026-10-25T09:00:00.000Z", weather: null },
    );
    expect(entry.content.capturedAt).toBe("2026-10-23T09:00:00.000Z");
    const e = ev.evaluateLog(entry).evidence.eventScores[0].checks.find((c) => c.key === "record")!;
    expect(e.ok).toBe(true);
    // Same entry with no capturedAt looks like a late, from-memory write-up.
    const late = ev.evaluateLog({ createdAt: entry.createdAt, content: { ...entry.content, capturedAt: undefined } }).evidence.eventScores[0].checks.find((c) => c.key === "record")!;
    expect(late.ok).toBe(false);
  });

  it("two racing syncs of the same offline entry produce exactly one sealed entry", async () => {
    const input = { logDate: "2026-10-24", author: "M", transcript: RICH_DAY, source: "voice" as const, attachments: [], addendumOf: null, clientId: "client-race-1" };
    const opts = { forceLocal: true, createdAt: "2026-10-25T10:00:00.000Z", weather: null };
    const [a, b] = await Promise.all([svc.sealLog(pid, input, opts), svc.sealLog(pid, input, opts)]);
    expect(a.entry.id).toBe(b.entry.id);
    expect(repo.listLogs(pid).filter((l) => l.content.clientId === "client-race-1")).toHaveLength(1);
    expect(repo.verifyProjectChain(pid).ok).toBe(true);
  });

  it("finds an entry by clientId, so a retried submission can't duplicate it", () => {
    expect(repo.findLogByClientId(pid, "client-offline-1")?.content.clientId).toBe("client-offline-1");
    expect(repo.findLogByClientId(pid, "never-seen")).toBeNull();
  });
});

describe("email receipts", () => {
  it("without a provider, records but does not deliver — and says so", async () => {
    vi.stubEnv("PLUMBLINE_SMTP_URL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendMail, mailMode } = await import("@/lib/email");
    expect(mailMode()).toBe("preview");
    const r = await sendMail({ to: ["rep@owner.test"], subject: "Notice", text: "body" });
    expect(r).toMatchObject({ status: "preview", provider: "preview", accepted: [] });
    expect(r.response).toMatch(/not delivered/i);
  });

  it("reports a provider's refusal as failed (fetch stubbed)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Invalid `to`" }), { status: 422 })));
    const { sendMail } = await import("@/lib/email");
    const r = await sendMail({ to: ["bad"], subject: "S", text: "t" });
    expect(r).toMatchObject({ status: "failed", provider: "resend" });
    vi.unstubAllGlobals();
    vi.stubEnv("RESEND_API_KEY", "");
  });
});
