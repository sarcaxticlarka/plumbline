import { emptyExtraction, type CauseT, type EventKindT, type ExtractedEvent, type Extraction, type PartyT } from "@/lib/domain/schema";
import {
  ACTIVITIES, AREA_RE, CAUSE_PATTERNS, CAUSE_TITLES, EQUIPMENT, NUM_RE, PARTY_NOUNS, TRADES, WORK_VERBS, toNumber,
} from "./lexicon";

/**
 * Offline, deterministic extractor. It is the safety net (no API key, no network, no data leaves the
 * device) and the reference implementation of the extraction contract. Claude handles the long tail of
 * phrasing; this handles the common site-talk patterns well enough to demo and to fall back on.
 */

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const uniq = <T,>(a: T[]) => [...new Set(a)];

export function splitSentences(text: string): string[] {
  const rough = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clean)
    .filter(Boolean);
  // Dictation often drops punctuation; break very long runs on conjunction boundaries.
  return rough.flatMap((s) =>
    s.length > 240 ? s.split(/\s+(?=(?:and then|then|also|but|so we|and we|and the)\s)/i).map(clean).filter(Boolean) : [s],
  );
}

/* ---------------- hours ---------------- */

export function hoursFrom(text: string): number | null {
  const t = text.toLowerCase();
  let m = t.match(/(\d+(?:\.\d+)?|a couple of|a couple|couple of|half an?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:more\s+)?(?:hours?|hrs?)\b/);
  if (m) {
    const w = m[1];
    if (/^half/.test(w)) return 0.5;
    if (/couple/.test(w)) return 2;
    return toNumber(w);
  }
  m = t.match(/(\d+)\s*(?:minutes?|mins?)\b/);
  if (m) return Math.round((Number(m[1]) / 60) * 100) / 100;
  if (/\b(?:all|whole|full|entire|rest of the)\s+day\b/.test(t)) return 8;
  if (/\bhalf (?:a |the )?day\b/.test(t)) return 4;
  if (/\b(?:all|most of the|whole|lost the|rest of the)\s+(?:morning|afternoon)\b/.test(t)) return 4;
  return null;
}

/* ---------------- trades / equipment ---------------- */

const tradeRes = TRADES.map((t) => ({ name: t.name, re: new RegExp(`\\b(?:${t.re})\\b`, "i") }));

function tradesIn(text: string): string[] {
  const out: string[] = [];
  for (const t of tradeRes) if (t.re.test(text)) out.push(t.name);
  for (const a of ACTIVITIES) if (new RegExp(`\\b${a}(?:s|ing|ed)?\\b`, "i").test(text)) out.push(cap(a));
  return uniq(out);
}

function findManpower(sentences: string[]): Extraction["manpower"] {
  const byTrade = new Map<string, { trade: string; headcount: number; hours: number | null; company: string | null }>();
  for (const s of sentences) {
    const found: { trade: string; n: number; end: number }[] = [];
    for (const t of TRADES) {
      const direct = new RegExp(`\\b${NUM_RE}\\s+(?:of\\s+(?:our|the)\\s+)?(?:${t.re})\\b`, "gi");
      for (const m of s.matchAll(direct)) found.push({ trade: t.name, n: toNumber(m[1]), end: (m.index ?? 0) + m[0].length });
      const crewOf = new RegExp(`\\b(?:${t.re})\\b[^.]{0,20}?\\b(?:crew of|had|with|brought|was)\\s+${NUM_RE}\\b`, "gi");
      for (const m of s.matchAll(crewOf)) found.push({ trade: t.name, n: toNumber(m[1]), end: (m.index ?? 0) + m[0].length });
    }
    if (!found.length) continue;
    const hours = /\b(?:delay|stood down|rained out|sent home|lost)\b/i.test(s) ? null : (s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i)?.[1] ?? null);
    for (const f of found) {
      const company = s.slice(f.end).match(/^[\s,]*from\s+([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,2})/)?.[1] ?? null;
      const cur = byTrade.get(f.trade);
      if (cur) {
        cur.headcount += f.n;
        cur.company ??= company;
      } else {
        byTrade.set(f.trade, {
          trade: f.trade,
          headcount: f.n,
          hours: found.length === 1 && hours ? Number(hours) : null,
          company,
        });
      }
    }
  }
  return [...byTrade.values()];
}

function findEquipment(sentences: string[]): Extraction["equipment"] {
  const out: Extraction["equipment"] = [];
  for (const s of sentences) {
    let masked = s;
    for (const e of EQUIPMENT) {
      const re = new RegExp(`(?:${NUM_RE}\\s+)?\\b(?:${e.re})s?\\b`, "i");
      const m = masked.match(re);
      if (!m) continue;
      masked = masked.replace(re, " ");
      const status: Extraction["equipment"][number]["status"] = /\b(broke|broken|breakdown|down for|out of service|hydraulic|failed)\b/i.test(s)
        ? "down"
        : /\b(idle|sat|parked|standing|stood|waiting|shut down|stood down|stand[- ]down)\b/i.test(s)
          ? "idle"
          : "active";
      if (!out.some((o) => o.name === e.name)) out.push({ name: e.name, count: m[1] ? toNumber(m[1]) : 1, status });
    }
  }
  return out;
}

/* ---------------- weather ---------------- */

function findWeather(text: string): Extraction["weather"] {
  const cond = uniq(
    (text.toLowerCase().match(/\b(sunny|clear|overcast|cloudy|partly cloudy|rain(?:ed|ing|y)?|drizzle|snow(?:ed|ing)?|sleet|fog(?:gy)?|windy|storm(?:y)?|hot|humid|freezing|cold|cool|mild)\b/g) ?? []).map((w) =>
      /^rain/.test(w) ? "rain" : /^snow/.test(w) ? "snow" : w,
    ),
  );
  const temp = text.match(/\b(\d{2,3})\s*(?:degrees|°|deg)\b/i);
  return {
    conditions: cond.length ? cond.join(", ") : null,
    highTempF: temp ? Number(temp[1]) : null,
    precipitationMentioned: /\b(rain|rained|raining|snow|sleet|drizzle|downpour|storm|hail)\b/i.test(text),
    windMentioned: /\b(wind|windy|gusts?)\b/i.test(text),
  };
}

/* ---------------- events ---------------- */

const STRONG_DELAY =
  /\b(delay(?:ed|s)?|held up|hold[- ]up|waiting (?:on|for)|still waiting|stood down|stand[- ]down|shut down|rained out|no access|sent (?:the )?(?:crew|guys|everyone|them) home|pushed (?:the )?(?:pour|lift|work)|postponed|cancel(?:l)?ed (?:the )?(?:pour|lift|crane|work)|never (?:showed|arrived|came)|didn'?t (?:show|arrive)|no[- ]show|(?:was|were|arrived|came in) late|hasn'?t (?:arrived|shown|answered|responded|approved|released|replied|issued)|has not (?:arrived|answered|responded|approved|released|replied|issued)|still hasn'?t)\b/i;
const WEAK_DELAY = /\b(stopped|couldn'?t|could not|unable to|can'?t|idle|standing around|lost (?:\d+|an?|half|most|the)|down for)\b/i;
const CHANGE = /\b(change order|added scope|extra work|additional work|out of scope|t&m|time and material|asi|bulletin|pco|owner (?:wants|asked|requested|added|decided)|asked us to (?:add|install|move|change)|wants us to|new (?:scope|detail|requirement)|revised? (?:drawings?|plans?|detail))\b/i;
const DIFFERING = /\b(unforeseen|unforeseeable|unmarked|unexpected (?:rock|ledge|water|utility|conditions?|obstruction|soil|void)|differing (?:site )?conditions?|not (?:shown )?on (?:the )?(?:drawings|plans)|abandoned|buried|ledge|rock (?:ledge|shelf)|contaminat\w*|asbestos|hazmat|groundwater|soft soil|unsuitable soil|old foundation|obstruction)\b/i;
const OWNER_DIRECTION = /\b(owner(?:'s rep)?|client|architect|engineer)\b[^.]{0,40}\b(told us|directed|instructed|ordered|made us|had us|said to|said we)\b/i;
const RFI = /\brfi\b/i;

const WEATHER_WORD = /\b(rain|rained|raining|storm|snow|sleet|wind|gust|lightning|freez|frost|ice|icy|flood|hail|weather|heat)\b/i;

function causeOf(kind: EventKindT, win: string): CauseT {
  if (kind === "differing_condition") return "differing_condition";
  if (kind === "change" || kind === "owner_direction") return "scope_change";
  for (const [cause, re] of CAUSE_PATTERNS) if (re.test(win)) return cause;
  return "other";
}

const attributions = PARTY_NOUNS.map(([party, nouns]) => ({
  party,
  re: new RegExp(
    `(?:waiting (?:on|for)|because of|due to|caused by|held up by|per|from)\\s+(?:the\\s+)?(?:${nouns})\\b|\\b(?:${nouns})\\b[^.,;]{0,40}\\b(?:hasn'?t|has not|didn'?t|did not|never|failed|won'?t|still waiting|is late|was late|late|slow|dropped|ordered|directed|told|instructed|stopped|shut|rejected|asked|wants|wanted|decided)\\b`,
    "i",
  ),
}));

function partyOf(cause: CauseT, win: string): PartyT {
  if (cause === "weather") return "weather";
  for (const a of attributions) if (a.re.test(win)) return a.party;
  return "unknown";
}

function weatherTitle(win: string): string {
  const wind = /\b(wind|winds|windy|gusts?|gusting)\b/i.test(win);
  const rain = /\b(rain\w*|storm\w*|shower\w*|downpour|snow\w*|sleet|flood\w*|ponding)\b/i.test(win);
  if (wind && !rain) return "Wind delay";
  if (rain && !wind) return "Rain delay";
  if (wind && rain) return "Storm delay";
  if (/\b(ice|icy|freez\w*|frost|cold)\b/i.test(win)) return "Cold-weather delay";
  if (/\bheat\b/i.test(win)) return "Heat delay";
  return "Weather delay";
}

function findEvents(sentences: string[]): { events: ExtractedEvent[]; eventSentences: Set<number> } {
  const n = sentences.length;
  const docWeather = WEATHER_WORD.test(sentences.join(" "));
  const kinds: (EventKindT | null)[] = new Array(n).fill(null);
  const strong: boolean[] = new Array(n).fill(false);
  const weakOnly: boolean[] = new Array(n).fill(false);

  sentences.forEach((s, i) => {
    const weather = WEATHER_WORD.test(s);
    if (DIFFERING.test(s) && !weather) kinds[i] = "differing_condition";
    else if (CHANGE.test(s)) kinds[i] = "change";
    else if (OWNER_DIRECTION.test(s) && !STRONG_DELAY.test(s)) kinds[i] = "owner_direction";
    else if (STRONG_DELAY.test(s)) { kinds[i] = "delay"; strong[i] = true; }
    else if (WEAK_DELAY.test(s)) { kinds[i] = "delay"; weakOnly[i] = true; }
    else if (RFI.test(s)) kinds[i] = "rfi";
  });

  const events: ExtractedEvent[] = [];
  const eventSentences = new Set<number>();

  for (let i = 0; i < n; i++) {
    const kind = kinds[i];
    if (!kind) continue;
    // A weak "lost four hours" right after an event sentence continues that event, unless it brings its own cause.
    if (weakOnly[i] && i > 0 && eventSentences.has(i - 1) && causeOf(kind, sentences[i]) === "other") {
      eventSentences.add(i);
      continue;
    }

    const own = sentences[i];
    const ownCause = causeOf(kind, own);
    // Continuation sentences: details of the same event (hours, "that", "lost…"), never a different topic.
    const OTHER_TOPIC = /\b(deliver\w*|inspect\w*|toolbox|incident|visited|walked the site)\b/i;
    let end = i;
    while (end + 1 < n && end < i + 2) {
      const nx = sentences[end + 1];
      const continues =
        (!kinds[end + 1] || (weakOnly[end + 1] && causeOf(kind, nx) === "other")) &&
        !OTHER_TOPIC.test(nx) &&
        (/^(it|that|this|they|we|which|so|because|lost|total|about|roughly|crew|the (?:crew|guys|work)|wind|gusts?|rain|temps?|temperature)\b/i.test(nx) ||
          hoursFrom(nx) !== null ||
          (ownCause !== "other" && causeOf(kind, nx) === ownCause));
      if (!continues) break;
      end++;
    }
    const ext = sentences.slice(i, end + 1).join(" ");
    const prev = i > 0 && !kinds[i - 1] && !eventSentences.has(i - 1) && !OTHER_TOPIC.test(sentences[i - 1]) ? sentences[i - 1] : "";

    const prev2 = i > 1 && !kinds[i - 2] && !OTHER_TOPIC.test(sentences[i - 2]) ? sentences[i - 2] : "";
    let cause = ownCause !== "other" ? ownCause : causeOf(kind, ext) !== "other" ? causeOf(kind, ext) : causeOf(kind, `${prev} ${ext}`);
    if (cause === "other" && kind === "delay") cause = causeOf(kind, `${prev2} ${prev} ${ext}`);
    // "stood down the pour" on a day that opened with "it rained all morning" is a weather delay.
    if (cause === "other" && kind === "delay" && docWeather && /\b(stood down|shut down|rained out|pour|crane|exterior|roof(?:ing)?|excavat\w*|concrete|lift)\b/i.test(ext)) cause = "weather";
    const hours = hoursFrom(own) ?? hoursFrom(ext);
    const trades = tradesIn(ext).length ? tradesIn(ext) : tradesIn(prev);
    const win = `${prev2} ${prev} ${ext}`;

    // Weak triggers need corroboration, otherwise "couldn't" in ordinary talk becomes a phantom delay.
    if (weakOnly[i] && cause === "other" && hours === null) continue;

    // "Stood down the pour" on a day that opened with "it rained all morning": carry the weather sentence along.
    const wxSentence = cause === "weather" && !WEATHER_WORD.test(ext)
      ? [sentences[i - 1], sentences[i - 2], sentences[i - 3]].find((t) => t && WEATHER_WORD.test(t)) ?? ""
      : "";
    const evidenceText = wxSentence ? `${wxSentence} ${ext}` : ext;

    let title: string;
    if (kind === "delay") {
      title = cause === "weather" ? weatherTitle(evidenceText) : CAUSE_TITLES[cause];
      if (cause === "weather" && /\bcrane\b/i.test(evidenceText)) title = title.replace(" delay", " — crane stand-down");
      else if (cause !== "weather" && trades.length) title += ` — ${trades[0]}`;
    } else if (kind === "change") title = "Scope change requested";
    else if (kind === "owner_direction") title = "Owner/design direction";
    else if (kind === "differing_condition") title = "Differing site condition";
    else title = "RFI raised";

    for (let k = i; k <= end; k++) if (k === i || !kinds[k] || weakOnly[k]) eventSentences.add(k);

    const crit =
      /\b(critical path|gates?|holding up|can'?t start|everything (?:is )?behind|behind schedule|pushes?|crane|steel|structure|foundation|slab|pour)\b/i.test(ext) ||
      (hours ?? 0) >= 8;

    events.push({
      kind,
      title,
      description: trunc(cap(clean(wxSentence ? `${wxSentence} ${evidenceText.slice(wxSentence.length + 1)}` : `${own}${end > i ? " " + sentences.slice(i + 1, end + 1).join(" ") : ""}`)), 320),
      cause: kind === "rfi" ? "design" : cause,
      hoursLost: kind === "delay" || kind === "differing_condition" ? hours : null,
      tradesAffected: trades,
      responsibleParty: kind === "rfi" ? "architect" : partyOf(cause, ext) !== "unknown" ? partyOf(cause, ext) : partyOf(cause, win),
      criticalPathLikely: crit && kind !== "rfi",
      quote: trunc(own, 200),
    });
  }
  return { events, eventSentences };
}

/* ---------------- everything else ---------------- */

function findDeliveries(sentences: string[]): Extraction["deliveries"] {
  const out: Extraction["deliveries"] = [];
  for (const s of sentences) {
    if (!/\b(deliver(?:y|ies|ed)|shipment|truck(?:s)? arrived|arrived|dropped off|showed up|received)\b/i.test(s)) continue;
    const item =
      s.match(/\b(?:delivery of|delivered|received|shipment of|dropped off)\s+(?:the\s+|our\s+)?([a-z0-9][a-z0-9 \-/"']{2,45}?)(?=[,.;]|\s+(?:from|but|and|at|on|for|was|were|arrived)\b|$)/i)?.[1] ??
      s.match(/\b(?:the\s+)?([a-z0-9][a-z0-9 \-]{2,30}?)\s+(?:delivery|shipment)\b/i)?.[1];
    if (!item) continue;
    const status: Extraction["deliveries"][number]["status"] =
      /\b(rejected|damaged|wrong|returned|sent back)\b/i.test(s) ? "rejected"
        : /\b(late|didn'?t (?:show|arrive)|never (?:showed|arrived)|not here|delayed|no[- ]show|hasn'?t (?:arrived|shown))\b/i.test(s) ? "late"
          : /\b(expected|scheduled|coming|due|will (?:be )?deliver|tomorrow)\b/i.test(s) ? "expected"
            : "received";
    const supplier = s.match(/\bfrom\s+([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,2})/)?.[1] ?? null;
    out.push({ item: cap(clean(item)), supplier, status });
  }
  return out.slice(0, 8);
}

function findInspections(sentences: string[]): Extraction["inspections"] {
  const out: Extraction["inspections"] = [];
  for (const s of sentences) {
    if (!/\binspect(?:ion|or|ed)\b/i.test(s)) continue;
    const type = s.match(/\b(framing|rough[- ]in|electrical|plumbing|fire(?: alarm| sprinkler)?|footing|rebar|foundation|concrete|special|building|final|elevator|mechanical|structural|sprinkler|insulation|drywall)\s+inspection\b/i)?.[1];
    const result: Extraction["inspections"][number]["result"] =
      /\b(cancel(?:l)?ed|rescheduled|postponed)\b/i.test(s) ? "cancelled"
        : /\b(failed|didn'?t pass|rejected|correction|red[- ]tag|not approved)\b/i.test(s) ? "failed"
          : /\b(passed|signed off|approved|got the green|cleared)\b/i.test(s) ? "passed"
            : "pending";
    const inspector = s.match(/\binspector\s+([A-Z][a-z]+)/)?.[1] ?? null;
    out.push({ type: type ? cap(type.toLowerCase()) : "General", result, inspector });
  }
  return out.slice(0, 6);
}

function findSafety(sentences: string[]): Extraction["safety"] {
  const out: Extraction["safety"] = [];
  for (const s of sentences) {
    if (/\b(toolbox|tailgate|safety (?:talk|meeting|briefing|stand[- ]down))\b/i.test(s))
      out.push({ kind: "toolbox_talk", description: trunc(cap(s), 200), injury: false });
    else if (/\bnear[- ]miss\b/i.test(s)) out.push({ kind: "near_miss", description: trunc(cap(s), 200), injury: false });
    else if (/\bno (?:incidents?|injur(?:y|ies)|accidents?|recordables?)\b/i.test(s))
      out.push({ kind: "observation", description: trunc(cap(s), 200), injury: false });
    else if (/\b(injur\w*|hurt|sprain\w*|first aid|ambulance|hospital|bleed\w*|fell from|fall from|struck by|accident|incident)\b/i.test(s))
      out.push({ kind: "incident", description: trunc(cap(s), 200), injury: /\b(injur\w*|hurt|sprain\w*|first aid|ambulance|hospital|bleed\w*)\b/i.test(s) });
    else if (/\b(osha|ppe|harness|guardrail|housekeeping|violation|unsafe|tied off|tie-off|fall protection)\b/i.test(s))
      out.push({ kind: "observation", description: trunc(cap(s), 200), injury: false });
  }
  return out.slice(0, 6);
}

function findVisitors(sentences: string[]): string[] {
  return sentences
    .filter((s) => /\b(owner'?s rep|architect|engineer|inspector|client|osha|insurance|lender|fire marshal)\b[^.]{0,40}\b(visited|walked|came by|toured|stopped by|on site|was here|were here)\b/i.test(s))
    .map((s) => trunc(cap(s), 140))
    .slice(0, 5);
}

const FUTURE = /\b(tomorrow|next week|will|going to|gonna|need to|have to|gotta|should|plan(?:ning)? to|scheduled)\b/i;

function findWork(sentences: string[], skip: Set<number>): Extraction["work"] {
  const verbs = new RegExp(`\\b(?:${WORK_VERBS})\\b`, "i");
  const out: Extraction["work"] = [];
  sentences.forEach((s, i) => {
    if (skip.has(i) || FUTURE.test(s) || !verbs.test(s)) return;
    out.push({ area: s.match(AREA_RE)?.[0]?.toLowerCase() ?? null, activity: trunc(cap(s.replace(/[.!]+$/, "")), 180) });
  });
  return out.slice(0, 10);
}

function findOpenItems(sentences: string[], skip: Set<number>): string[] {
  return sentences
    .filter((s, i) => !skip.has(i) && /\b(need to|have to|gotta|follow up|will (?:send|submit|call|schedule|confirm|get|order)|still (?:need|waiting)|pending|tomorrow (?:we|i))\b/i.test(s))
    .map((s) => trunc(cap(s.replace(/[.!]+$/, "")), 160))
    .slice(0, 6);
}

function summarize(x: Extraction): string {
  const people = x.manpower.reduce((a, m) => a + m.headcount, 0);
  const parts: string[] = [];
  if (people) parts.push(`${people} workers on site across ${x.manpower.length} trade${x.manpower.length === 1 ? "" : "s"}.`);
  if (x.work[0]) parts.push(`${x.work[0].activity}${/[.!?]$/.test(x.work[0].activity) ? "" : "."}`);
  if (x.events.length) parts.push(`${x.events.length} claim-relevant event${x.events.length === 1 ? "" : "s"}: ${x.events.map((e) => e.title).join("; ")}.`);
  else parts.push("No delays or changes reported.");
  return parts.join(" ");
}

export function extractLocal(transcript: string): Extraction {
  const out = emptyExtraction();
  const sentences = splitSentences(transcript);
  if (!sentences.length) return out;

  const { events, eventSentences } = findEvents(sentences);
  out.events = events;
  out.weather = findWeather(transcript);
  out.manpower = findManpower(sentences);
  out.equipment = findEquipment(sentences);
  out.deliveries = findDeliveries(sentences);
  out.inspections = findInspections(sentences);
  out.safety = findSafety(sentences);
  out.visitors = findVisitors(sentences);
  out.work = findWork(sentences, eventSentences);
  out.openItems = findOpenItems(sentences, new Set());
  out.summary = summarize(out);
  return out;
}
