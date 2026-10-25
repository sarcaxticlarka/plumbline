import type { ExtractedEvent } from "@/lib/domain/schema";
import type { WeatherEvidence, WeatherVerdict } from "@/lib/domain/types";

/**
 * Pure judgement: does measured weather support a claimed weather delay?
 * Thresholds are deliberately conservative and documented, because this output
 * is shown to users as corroboration, not as a legal conclusion.
 */
export const THRESHOLDS = {
  /** 2.5 mm ≈ 0.1 in of rain in a day — enough to stop pours, roofing, exterior finishes. */
  rainMm: 2.5,
  /** ~40 km/h (≈ 25 mph) daily max gust — common crane / lift stand-down territory. */
  windKmh: 40,
  /** At or below 2 °C overnight lows (≈ 36 °F) — cold-weather concrete and masonry protection range. */
  coldMinC: 2,
  /** At or above 35 °C (95 °F) — hot-weather work-rest and concrete placement limits. */
  heatMaxC: 35,
} as const;

export type WeatherKind = "rain" | "wind" | "cold" | "heat" | "unspecified";

const KIND_PATTERNS: [Exclude<WeatherKind, "unspecified">, RegExp][] = [
  ["wind", /\b(wind|winds|windy|gust|gusts|gusting)\b/i],
  ["rain", /\b(rain|rained|raining|rainy|storm|storms|shower|showers|downpour|snow|snowed|sleet|flood|flooded|flooding|ponding|soaked|wet)\b/i],
  ["cold", /\b(freeze|freezing|frozen|frost|ice|icy|cold|below freezing)\b/i],
  ["heat", /\b(heat|hot|extreme heat|heat index)\b/i],
];

/** Every weather mechanism the event text mentions (empty when it names none). */
export function weatherKindsOf(e: Pick<ExtractedEvent, "title" | "description" | "quote">): Exclude<WeatherKind, "unspecified">[] {
  const text = `${e.title} ${e.description} ${e.quote}`;
  return KIND_PATTERNS.filter(([, re]) => re.test(text)).map(([k]) => k);
}

export function weatherKindOf(e: Pick<ExtractedEvent, "title" | "description" | "quote">): WeatherKind {
  return weatherKindsOf(e)[0] ?? "unspecified";
}

export interface WeatherJudgement {
  verdict: WeatherVerdict;
  kind: WeatherKind;
  explanation: string;
}

export function judgeWeatherEvent(
  e: Pick<ExtractedEvent, "cause" | "title" | "description" | "quote">,
  w: WeatherEvidence | null,
): WeatherJudgement {
  if (e.cause !== "weather") return { verdict: "not_applicable", kind: "unspecified", explanation: "Not a weather event." };
  const kind = weatherKindOf(e);
  if (!w) return { verdict: "unavailable", kind, explanation: "No site weather record was available for this date." };

  const rain = w.precipitationMm;
  const wind = w.windMaxKmh;
  const tmin = w.tempMinC;
  const tmax = w.tempMaxC;

  const fmt = (n: number | null, u: string) => (n === null ? "n/a" : `${Math.round(n * 10) / 10} ${u}`);

  const tests: Record<Exclude<WeatherKind, "unspecified">, { ok: boolean | null; text: string }> = {
    rain: {
      ok: rain === null ? null : rain >= THRESHOLDS.rainMm,
      text: `precipitation ${fmt(rain, "mm")} (threshold ${THRESHOLDS.rainMm} mm)`,
    },
    wind: {
      ok: wind === null ? null : wind >= THRESHOLDS.windKmh,
      text: `max gust ${fmt(wind, "km/h")} (threshold ${THRESHOLDS.windKmh} km/h)`,
    },
    cold: {
      ok: tmin === null ? null : tmin <= THRESHOLDS.coldMinC,
      text: `low ${fmt(tmin, "°C")} (threshold ≤ ${THRESHOLDS.coldMinC} °C)`,
    },
    heat: {
      ok: tmax === null ? null : tmax >= THRESHOLDS.heatMaxC,
      text: `high ${fmt(tmax, "°C")} (threshold ≥ ${THRESHOLDS.heatMaxC} °C)`,
    },
  };

  const mentioned = weatherKindsOf(e);
  const order: Exclude<WeatherKind, "unspecified">[] = mentioned.length ? mentioned : ["rain", "wind", "cold", "heat"];
  const results = order.map((k) => ({ k, t: tests[k] }));
  const hit = results.find((r) => r.t.ok === true);
  if (hit) return { verdict: "corroborated", kind: hit.k, explanation: `Site record supports it: ${hit.t.text}.` };
  if (results.every((r) => r.t.ok === null)) {
    return { verdict: "unavailable", kind, explanation: "The weather service returned no usable values for this date." };
  }
  return {
    verdict: "not_supported",
    kind,
    explanation: `Site record does not show it: ${results.map((r) => r.t.text).join("; ")}. Add detail or photos.`,
  };
}
