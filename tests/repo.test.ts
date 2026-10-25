import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plumbline-"));

describe("sealing, verification and tamper detection (real SQLite)", () => {
  let repo: typeof import("@/lib/db/repo");
  let svc: typeof import("@/lib/services");
  let projectId = "";

  beforeAll(async () => {
    vi.stubEnv("PLUMBLINE_DB", path.join(dir, "t.db"));
    vi.stubEnv("PLUMBLINE_SEED", "0");
    repo = await import("@/lib/db/repo");
    svc = await import("@/lib/services");
    const { RULE_PRESETS } = await import("@/lib/domain/types");
    projectId = repo.insertProject({
      name: "Test", address: "", client: "C", contractor: "K", contractRef: "", ownerName: "", ownerEmail: "", lat: null, lon: null, rules: RULE_PRESETS.tight7.rules,
    }).id;
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const seal = (date: string, t: string) =>
    svc.sealLog(projectId, { logDate: date, author: "M", transcript: t, source: "text", attachments: [], addendumOf: null }, { forceLocal: true, createdAt: `${date}T15:00:00.000Z`, weather: null });

  it("chains entries and verifies", async () => {
    const { RICH_DAY, CHANGE_DAY } = await import("./fixtures");
    const a = await seal("2026-10-20", RICH_DAY);
    const b = await seal("2026-10-21", CHANGE_DAY);
    expect(a.entry.seq).toBe(1);
    expect(b.entry.prevHash).toBe(a.entry.hash);
    expect(repo.verifyProjectChain(projectId)).toMatchObject({ ok: true, checked: 2 });
  });

  it("derives events with notice deadlines from the sealed content", () => {
    const events = repo.listEvents(projectId);
    expect(events.length).toBeGreaterThanOrEqual(4);
    const wind = events.find((e) => e.cause === "weather")!;
    expect(wind.noticeDueOn).toBe("2026-10-27");
    repo.upsertNotice(wind.id, projectId, "sent", "2026-10-21");
    expect(repo.listEvents(projectId).find((e) => e.id === wind.id)).toMatchObject({ noticeStatus: "sent", noticeSentOn: "2026-10-21" });
  });

  it("catches a silent database edit", () => {
    const t = repo.tamperWithLog(projectId);
    expect(t).not.toBeNull();
    const r = repo.verifyProjectChain(projectId);
    expect(r.ok).toBe(false);
    expect(r.brokenAtSeq).toBe(t!.seq);
  });
});
