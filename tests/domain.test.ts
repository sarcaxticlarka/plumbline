import { describe, expect, it } from "vitest";
import { addDays, diffDays } from "@/lib/domain/dates";
import { noticeClock, noticeDueOn, describeClock } from "@/lib/domain/notice";
import { GENESIS, canonicalJson, computeHash, verifyChain } from "@/lib/domain/chain";
import { evaluateEntry } from "@/lib/domain/evidence";
import { judgeWeatherEvent } from "@/lib/weather/thresholds";
import { emptyExtraction } from "@/lib/domain/schema";
import { RULE_PRESETS, type LogEntry, type SealedContent } from "@/lib/domain/types";
import { extractLocal } from "@/lib/ai/local";
import { RICH_DAY } from "./fixtures";

const rules = RULE_PRESETS.tight7.rules;

describe("dates", () => {
  it("does calendar math across month boundaries", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(diffDays("2026-10-25", "2026-10-20")).toBe(-5);
  });
});

describe("notice clock", () => {
  it("computes due dates by event kind", () => {
    expect(noticeDueOn("delay", "2026-10-20", rules)).toBe("2026-10-27");
    expect(noticeDueOn("rfi", "2026-10-20", rules)).toBeNull();
    expect(noticeDueOn("differing_condition", "2026-10-20", RULE_PRESETS.standard21.rules)).toBe("2026-11-03");
  });
  it("classifies urgency", () => {
    const today = "2026-10-25";
    expect(noticeClock("2026-10-23", today, "open")?.state).toBe("overdue");
    expect(noticeClock("2026-10-25", today, "open")?.state).toBe("due_today");
    expect(noticeClock("2026-10-27", today, "open")?.state).toBe("critical");
    expect(noticeClock("2026-10-30", today, "open")?.state).toBe("soon");
    expect(noticeClock("2026-11-20", today, "open")?.state).toBe("open");
    expect(noticeClock("2026-10-01", today, "sent")?.state).toBe("sent");
    expect(describeClock(noticeClock("2026-10-23", today, "open")!)).toBe("2 days overdue");
  });
});

const content = (n: number): SealedContent => ({
  logDate: `2026-10-${10 + n}`, author: "T", source: "text", transcript: `entry ${n}`, structured: emptyExtraction(),
  attachments: [], weather: null, provider: { name: "local", model: null }, addendumOf: null,
});
function makeChain(len: number): LogEntry[] {
  const out: LogEntry[] = [];
  let prev = GENESIS;
  for (let i = 1; i <= len; i++) {
    const c = content(i), createdAt = `2026-10-${10 + i}T12:00:00.000Z`;
    const hash = computeHash({ seq: i, projectId: "p", createdAt, prevHash: prev, content: c });
    out.push({ id: `l${i}`, projectId: "p", seq: i, createdAt, prevHash: prev, hash, content: c, score: 0 });
    prev = hash;
  }
  return out;
}

describe("hash chain", () => {
  it("is canonical regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
  it("verifies an intact chain", () => {
    const r = verifyChain(makeChain(5));
    expect(r).toMatchObject({ ok: true, checked: 5 });
  });
  it("detects edited content", () => {
    const c = makeChain(5);
    c[2].content.transcript = "something else";
    expect(verifyChain(c)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
  it("detects a deleted entry", () => {
    const c = makeChain(5);
    c.splice(1, 1);
    expect(verifyChain(c)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
  it("detects a forged hash that was recomputed in isolation", () => {
    const c = makeChain(4);
    c[1].content.transcript = "forged";
    c[1].hash = computeHash({ seq: 2, projectId: "p", createdAt: c[1].createdAt, prevHash: c[1].prevHash, content: c[1].content });
    expect(verifyChain(c)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
});

describe("weather corroboration", () => {
  const ev = { cause: "weather" as const, title: "Wind — crane stand-down", description: "", quote: "crane shut down for wind gusts" };
  const wx = (o: Partial<{ p: number; w: number; tmin: number; tmax: number }>) => ({
    source: "open-meteo" as const, fetchedAt: "", date: "2026-10-20", lat: 0, lon: 0,
    precipitationMm: o.p ?? 0, windMaxKmh: o.w ?? 10, tempMinC: o.tmin ?? 10, tempMaxC: o.tmax ?? 20,
  });
  it("supports a wind claim when gusts are high and rejects it when calm", () => {
    expect(judgeWeatherEvent(ev, wx({ w: 52 })).verdict).toBe("corroborated");
    expect(judgeWeatherEvent(ev, wx({ w: 15 })).verdict).toBe("not_supported");
  });
  it("handles rain, missing data and non-weather events", () => {
    expect(judgeWeatherEvent({ ...ev, title: "Rain delay", quote: "rained all morning" }, wx({ p: 9 })).verdict).toBe("corroborated");
    expect(judgeWeatherEvent({ ...ev, title: "Rain delay", quote: "rained all morning" }, wx({ p: 0 })).verdict).toBe("not_supported");
    expect(judgeWeatherEvent(ev, null).verdict).toBe("unavailable");
    expect(judgeWeatherEvent({ ...ev, cause: "design" }, wx({})).verdict).toBe("not_applicable");
  });
});

describe("evidence scoring", () => {
  const ctx = { photos: 0, logDate: "2026-10-20", recordedOn: "2026-10-20", weatherVerdicts: ["corroborated", "not_applicable"] as never };
  it("rewards a complete, corroborated record and asks for what is missing", () => {
    const x = extractLocal(RICH_DAY);
    const r = evaluateEntry(x, RICH_DAY, ctx);
    expect(r.score).toBeGreaterThan(50);
    // The RFI delay has no hours and no photo: those must show up as questions.
    const keys = r.gaps.filter((g) => g.scope === "event").map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(["hours", "corroboration"]));
    expect(r.gaps[0].severity).toBe("high");
  });
  it("penalises late logging", () => {
    const x = extractLocal(RICH_DAY);
    const onTime = evaluateEntry(x, RICH_DAY, ctx).score;
    const late = evaluateEntry(x, RICH_DAY, { ...ctx, recordedOn: "2026-10-24" }).score;
    expect(late).toBeLessThan(onTime);
  });
  it("scores a bare transcript low", () => {
    expect(evaluateEntry(emptyExtraction(), "stuff happened", { ...ctx, weatherVerdicts: [] }).score).toBeLessThan(50);
  });
});
