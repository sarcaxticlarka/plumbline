import type { ExtractedEvent, Extraction } from "./schema";
import type { EvidenceCheck, Gap, WeatherVerdict } from "./types";

/**
 * Evidence scoring: how well would this record stand up if someone challenged it later?
 * Deterministic and explainable on purpose — every point lost maps to a concrete question
 * the superintendent can answer out loud.
 */

export interface EventContext {
  weatherVerdict: WeatherVerdict;
  photos: number;
  /** Logged on the same calendar day the event occurred. */
  contemporaneous: boolean;
  inspectionRecorded: boolean;
}

export function eventChecks(e: ExtractedEvent, ctx: EventContext): EvidenceCheck[] {
  const isWeather = e.cause === "weather";
  const corroborated = isWeather
    ? ctx.weatherVerdict === "corroborated"
    : ctx.photos > 0 || ctx.inspectionRecorded;

  return [
    {
      key: "cause",
      label: "Cause identified",
      ok: e.cause !== "other",
      weight: 20,
      hint: "What caused it? Weather, a design question, owner direction, a late delivery, an inspection…",
    },
    {
      key: "hours",
      label: "Impact quantified",
      ok: e.hoursLost !== null && e.hoursLost > 0,
      weight: 20,
      hint: "Roughly how many work hours were lost?",
    },
    {
      key: "trades",
      label: "Affected trades named",
      ok: e.tradesAffected.length > 0,
      weight: 15,
      hint: "Which trades or activities were stopped or slowed?",
    },
    {
      key: "party",
      label: "Responsible party stated",
      ok: e.responsibleParty !== "unknown",
      weight: 15,
      hint: "Who was responsible — owner, architect, a sub, a supplier, the weather?",
    },
    {
      key: "record",
      label: "Contemporaneous wording",
      ok: ctx.contemporaneous && e.quote.trim().length > 6,
      weight: 10,
      hint: ctx.contemporaneous
        ? "Say what happened in your own words so the record preserves them."
        : "This is being logged after the day it happened — note when you first learned of it.",
    },
    {
      key: "corroboration",
      label: isWeather ? "Weather record corroborates" : "Photo or inspection backs it up",
      ok: corroborated,
      weight: 20,
      hint: isWeather
        ? ctx.weatherVerdict === "unavailable"
          ? "No weather record for the site date — add a project location, or attach a photo."
          : "Measured weather doesn't show it — describe conditions or attach a photo."
        : "Attach a photo of the affected area, or reference the inspection or RFI number.",
    },
  ];
}

export const scoreFromChecks = (checks: EvidenceCheck[]): number => {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return total === 0 ? 100 : Math.round((got / total) * 100);
};

export interface EntryContext {
  photos: number;
  logDate: string;
  recordedOn: string;
  weatherVerdicts: WeatherVerdict[];
}

export interface EntryEvidence {
  score: number;
  eventScores: { checks: EvidenceCheck[]; score: number }[];
  entryChecks: EvidenceCheck[];
  gaps: Gap[];
}

const wordCount = (s: string) => (s.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

export function evaluateEntry(x: Extraction, transcript: string, ctx: EntryContext): EntryEvidence {
  const contemporaneous = ctx.recordedOn <= ctx.logDate;
  const inspectionRecorded = x.inspections.length > 0;

  const eventScores = x.events.map((e, i) => {
    const checks = eventChecks(e, {
      weatherVerdict: ctx.weatherVerdicts[i] ?? "unavailable",
      photos: ctx.photos,
      contemporaneous,
      inspectionRecorded,
    });
    return { checks, score: scoreFromChecks(checks) };
  });

  const hasWeather =
    x.weather.conditions !== null || x.weather.highTempF !== null || x.weather.precipitationMentioned || x.weather.windMentioned;

  const entryChecks: EvidenceCheck[] = [
    { key: "manpower", label: "Manpower recorded", ok: x.manpower.length > 0, weight: 15, hint: "How many people were on site, by trade?" },
    { key: "weather", label: "Conditions recorded", ok: hasWeather, weight: 10, hint: "What were the weather conditions?" },
    { key: "work", label: "Work performed recorded", ok: x.work.length > 0, weight: 15, hint: "What work was actually performed, and where?" },
    { key: "safety", label: "Safety or inspections noted", ok: x.safety.length > 0 || x.inspections.length > 0, weight: 5, hint: "Any toolbox talk, safety observation or inspection today?" },
    { key: "detail", label: "Enough detail", ok: wordCount(transcript) >= 60, weight: 10, hint: "A fuller account (about 60+ words) makes a stronger record." },
    { key: "photos", label: "Photo evidence attached", ok: ctx.photos > 0, weight: 5, hint: "Attach at least one photo of the work or the problem." },
  ];

  const base = entryChecks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0); // max 60
  const eventAvg = eventScores.length ? eventScores.reduce((s, e) => s + e.score, 0) / eventScores.length : 100;
  const score = Math.round(base + (eventAvg / 100) * 40);

  const gaps: Gap[] = [];
  eventScores.forEach((es, i) => {
    es.checks
      .filter((c) => !c.ok)
      .forEach((c) =>
        gaps.push({
          scope: "event",
          eventIndex: i,
          key: c.key,
          severity: c.weight >= 20 ? "high" : c.weight >= 15 ? "medium" : "low",
          question: c.hint,
        }),
      );
  });
  entryChecks
    .filter((c) => !c.ok)
    .forEach((c) =>
      gaps.push({
        scope: "entry",
        key: c.key,
        severity: c.weight >= 15 ? "medium" : "low",
        question: c.hint,
      }),
    );

  const rank = { high: 0, medium: 1, low: 2 } as const;
  gaps.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { score, eventScores, entryChecks, gaps };
}

export const scoreLabel = (s: number): { label: string; tone: "good" | "ok" | "weak" } =>
  s >= 80 ? { label: "Claim-grade", tone: "good" } : s >= 55 ? { label: "Solid", tone: "ok" } : { label: "Thin", tone: "weak" };
