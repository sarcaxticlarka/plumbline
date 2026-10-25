import { describe, expect, it } from "vitest";
import { extractLocal, hoursFrom } from "@/lib/ai/local";
import { ExtractionSchema } from "@/lib/domain/schema";
import { RICH_DAY, CHANGE_DAY, QUIET_DAY } from "./fixtures";

describe("local extractor", () => {
  const rich = extractLocal(RICH_DAY);

  it("always satisfies the extraction contract", () => {
    for (const t of [RICH_DAY, CHANGE_DAY, QUIET_DAY, "", "hello"]) expect(ExtractionSchema.safeParse(extractLocal(t)).success).toBe(true);
  });

  it("reads manpower with companies", () => {
    expect(rich.manpower).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ trade: "Ironworkers", headcount: 12 }),
        expect.objectContaining({ trade: "Carpenters", headcount: 8, company: "Atlas Framing" }),
        expect.objectContaining({ trade: "Laborers", headcount: 6 }),
      ]),
    );
  });

  it("finds the wind delay with hours and responsibility", () => {
    const wind = rich.events.find((e) => e.cause === "weather");
    expect(wind).toMatchObject({ kind: "delay", hoursLost: 4, responsibleParty: "weather", criticalPathLikely: true });
    expect(wind?.quote).toMatch(/shut down/);
  });

  it("attributes an RFI delay to the architect without inventing hours", () => {
    const rfi = rich.events.find((e) => e.cause === "design");
    expect(rfi).toMatchObject({ kind: "delay", responsibleParty: "architect", hoursLost: null });
  });

  it("separates scope change, differing condition and late delivery", () => {
    const x = extractLocal(CHANGE_DAY);
    expect(x.events.map((e) => e.kind)).toEqual(["change", "differing_condition", "delay"]);
    expect(x.events[1].hoursLost).toBe(8);
    expect(x.events[2].cause).toBe("material");
    expect(x.deliveries[0]).toMatchObject({ status: "late", supplier: "Gulf Supply" });
    expect(x.inspections[0]).toMatchObject({ result: "passed" });
  });

  it("does not invent events on a quiet day", () => {
    const x = extractLocal(QUIET_DAY);
    expect(x.events).toHaveLength(0);
    expect(x.safety.some((s) => s.kind === "toolbox_talk")).toBe(true);
    expect(x.safety.some((s) => s.kind === "incident")).toBe(false);
  });

  it("parses hour phrases", () => {
    expect(hoursFrom("lost about four hours")).toBe(4);
    expect(hoursFrom("sat idle for 90 minutes")).toBe(1.5);
    expect(hoursFrom("we lost half a day")).toBe(4);
    expect(hoursFrom("stopped for the rest of the day")).toBe(8);
    expect(hoursFrom("a normal day")).toBeNull();
  });
});
