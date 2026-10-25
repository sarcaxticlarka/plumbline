import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { anchorDigest, anchorMessage, buildTimestampRequest, parseTimestampResponse, tlv } from "@/lib/anchor/der";
import { RICH_DAY, CHANGE_DAY } from "./fixtures";

describe("RFC 3161 request/response handling", () => {
  const digest = anchorDigest("proj1", 7, "ab".repeat(32));

  it("domain-separates the digest so anyone can recompute it", () => {
    expect(anchorMessage("proj1", 7, "ab".repeat(32))).toBe(`plumbline-chain-head:v1:proj1:7:${"ab".repeat(32)}`);
    expect(digest.equals(createHash("sha256").update(anchorMessage("proj1", 7, "ab".repeat(32))).digest())).toBe(true);
  });

  it("builds a well-formed TimeStampReq (version 1, SHA-256 imprint, nonce, certReq)", () => {
    const { der, nonce } = buildTimestampRequest(digest, Buffer.from([0x80, 1, 2, 3, 4, 5, 6, 7]));
    expect(der[0]).toBe(0x30);
    expect(der.indexOf(digest)).toBeGreaterThan(0);
    expect(der.includes(Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]))).toBe(true); // sha256 OID
    expect(der.subarray(-3).equals(Buffer.from([0x01, 0x01, 0xff]))).toBe(true); // certReq TRUE
    expect(der.includes(Buffer.concat([Buffer.from([0x02, 0x09, 0x00]), nonce]))).toBe(true); // high bit => leading zero, still positive
  });

  const fakeResponse = (status: number, gen = "20261025180501Z", withDigest = true) => {
    const imprint = tlv(0x30, tlv(0x30, Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]), Buffer.from([5, 0])), tlv(0x04, withDigest ? digest : Buffer.alloc(32)));
    const tst = tlv(0x30, tlv(0x02, Buffer.from([1])), tlv(0x06, Buffer.from([0x2a, 0x03])), imprint, tlv(0x02, Buffer.from([9])), tlv(0x18, Buffer.from(gen, "latin1")), tlv(0x02, Buffer.from([0x7f, 1, 2, 3, 4, 5, 6, 7])));
    return tlv(0x30, tlv(0x30, tlv(0x02, Buffer.from([status]))), tlv(0x30, tlv(0x06, Buffer.from([0x2a, 0x86])), tlv(0xa0, tlv(0x04, tst))));
  };

  it("reads status, echoed digest/nonce and the stamped time", () => {
    const r = parseTimestampResponse(fakeResponse(0), digest, Buffer.from([0x7f, 1, 2, 3, 4, 5, 6, 7]));
    expect(r).toMatchObject({ granted: true, status: 0, genTime: "2026-10-25T18:05:01Z", digestEchoed: true, nonceEchoed: true });
  });
  it("rejects refusals and responses that don't echo our digest", () => {
    expect(parseTimestampResponse(fakeResponse(2), digest, Buffer.alloc(8)).granted).toBe(false);
    expect(parseTimestampResponse(fakeResponse(0, undefined, false), digest, Buffer.alloc(8)).digestEchoed).toBe(false);
    expect(() => parseTimestampResponse(Buffer.from([1, 2, 3]), digest, Buffer.alloc(8))).toThrow();
  });
});

describe("anchors expose a rewritten chain (real SQLite)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plumbline-anchor-"));
  let repo: typeof import("@/lib/db/repo");
  let svc: typeof import("@/lib/services");
  let anchors: typeof import("@/lib/anchor/service");
  let pid = "";

  beforeAll(async () => {
    vi.stubEnv("PLUMBLINE_DB", path.join(dir, "n.db"));
    vi.stubEnv("PLUMBLINE_SEED", "0");
    repo = await import("@/lib/db/repo");
    svc = await import("@/lib/services");
    anchors = await import("@/lib/anchor/service");
    pid = repo.insertProject({ name: "A", address: "", client: "", contractor: "", contractRef: "", ownerName: "Rep", ownerEmail: "rep@owner.test", lat: null, lon: null, rules: { preset: "x", delayNoticeDays: 7, changeNoticeDays: 7, differingConditionNoticeDays: 7 } }).id;
    for (const [d, t] of [["2026-10-20", RICH_DAY], ["2026-10-21", CHANGE_DAY], ["2026-10-22", RICH_DAY]] as const)
      await svc.sealLog(pid, { logDate: d, author: "M", transcript: t, source: "text", attachments: [], addendumOf: null }, { forceLocal: true, createdAt: `${d}T15:00:00.000Z`, weather: null });
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("starts clean, with no anchors", () => {
    const i = anchors.integrity(pid);
    expect(i.chain.ok).toBe(true);
    expect(i.anchors).toEqual([]);
  });

  it("emailing the chain head in preview mode records it but does NOT count as an anchor", async () => {
    const out = await anchors.anchorProject(pid, { rfc3161: false, email: true });
    expect(out.created[0]).toMatchObject({ kind: "email", status: "preview" });
    expect(anchors.integrity(pid).anchors).toHaveLength(0); // nothing was delivered, so nothing external exists
    expect(repo.listEmails(pid)[0]).toMatchObject({ kind: "anchor", status: "preview", to: ["rep@owner.test"] });
  });

  it("a recorded external anchor catches a full rewrite that the chain alone cannot", () => {
    const head = repo.listLogs(pid).at(-1)!;
    repo.insertAnchor({ projectId: pid, headSeq: head.seq, headHash: head.hash, kind: "rfc3161", status: "timestamped", detail: { genTime: "2026-10-22T16:00:00Z" } });
    expect(anchors.integrity(pid)).toMatchObject({ anchoredOk: true, chain: { ok: true } });

    expect(repo.rewriteHistory(pid)).not.toBeNull();
    const after = anchors.integrity(pid);
    expect(after.chain.ok).toBe(true); // the attacker recomputed every hash — the chain verifies!
    expect(after.anchoredOk).toBe(false); // …but the externally held fingerprint no longer matches
    expect(after.anchors[0].reason).toMatch(/rewritten|no longer matches/);
  });

  it("refuses to anchor a record that fails verification", async () => {
    const out = await anchors.anchorProject(pid, { rfc3161: false, email: false });
    expect(out.created).toHaveLength(0);
    expect(out.errors[0]).toMatch(/fails verification/);
  });
});
