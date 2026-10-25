import { describe, expect, it } from "vitest";
import { enforceVerbatimQuotes } from "@/lib/ai";
import { extractLocal } from "@/lib/ai/local";
import { weatherKindsOf, judgeWeatherEvent } from "@/lib/weather/thresholds";
import { emptyExtraction } from "@/lib/domain/schema";
import { RAIN_DAY, RICH_DAY } from "./fixtures";

describe("weather attribution in the offline extractor", () => {
  const x = extractLocal(RAIN_DAY);
  it("labels a stood-down pour on a rainy morning as a rain delay, not a wind delay", () => {
    expect(x.events).toHaveLength(1);
    expect(x.events[0]).toMatchObject({ cause: "weather", hoursLost: 5, responsibleParty: "weather" });
    expect(x.events[0].title).toMatch(/rain/i);
    expect(weatherKindsOf(x.events[0])).toEqual(["rain"]);
  });
  it("judges the claim against the measured kind only", () => {
    const wx = (p: number, w: number) => ({ source: "open-meteo" as const, fetchedAt: "", date: "", lat: 0, lon: 0, precipitationMm: p, windMaxKmh: w, tempMinC: 10, tempMaxC: 18 });
    expect(judgeWeatherEvent(x.events[0], wx(9, 10)).verdict).toBe("corroborated");
    // Very windy but dry: a *rain* delay must not be corroborated by wind.
    expect(judgeWeatherEvent(x.events[0], wx(0, 60)).verdict).toBe("not_supported");
  });
});

describe("anti-hallucination guard", () => {
  it("drops quotes that are not verbatim in the transcript and clamps absurd values", () => {
    const base = extractLocal(RICH_DAY);
    const forged = {
      ...emptyExtraction(),
      events: [
        { ...base.events[0], quote: "the TOWER crane was shut down at ten thirty, because of wind gusts" }, // verbatim modulo case/punctuation
        { ...base.events[0], quote: "An invented sentence the speaker never said", hoursLost: 9999 },
      ],
      manpower: [{ trade: "Ghosts", headcount: 100000, hours: null, company: null }],
    };
    const out = enforceVerbatimQuotes(forged, RICH_DAY);
    expect(out.events[0].quote).not.toBe("");
    expect(out.events[1].quote).toBe("");
    expect(out.events[1].hoursLost).toBeNull();
    expect(out.manpower).toHaveLength(0);
  });
});
