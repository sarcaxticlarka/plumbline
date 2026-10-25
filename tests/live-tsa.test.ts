import { describe, expect, it } from "vitest";
import fs from "node:fs";

/** Network test, opt-in:  PLUMBLINE_LIVE_TSA=1 npx vitest run tests/live-tsa.test.ts */
describe.skipIf(!process.env.PLUMBLINE_LIVE_TSA)("live RFC 3161 timestamp", () => {
  it("gets a real timestamp for a chain head and the response echoes our digest", async () => {
    const { requestTimestamp } = await import("@/lib/anchor/service");
    const hash = "ab".repeat(32);
    const t = await requestTimestamp("live-check", 1, hash);
    expect(t.genTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(t.nonceEchoed).toBe(true);
    fs.writeFileSync("/tmp/plumbline-live.tsr", Buffer.from(t.tsrBase64, "base64"));
    fs.writeFileSync("/tmp/plumbline-live.digest", t.digestHex);
    console.log("TSA", t.tsa, "genTime", t.genTime);
  }, 40_000);
});
