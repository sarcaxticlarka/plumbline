import "server-only";
import { extract, type ExtractResult } from "@/lib/ai";
import type { AiConfig } from "@/lib/ai/config";
import { extractLocal } from "@/lib/ai/local";
import { fetchSiteWeather } from "@/lib/weather";
import { evaluateLog, type LogEvaluation } from "@/lib/domain/events";
import { evaluateEntry, type EntryEvidence } from "@/lib/domain/evidence";
import { judgeWeatherEvent } from "@/lib/weather/thresholds";
import { noticeClock, URGENCY_ORDER } from "@/lib/domain/notice";
import { todayLocal } from "@/lib/domain/dates";
import type { Extraction } from "@/lib/domain/schema";
import type { Attachment, ChainResult, EventRecord, LogEntry, Project, SealedContent, WeatherEvidence, WeatherVerdict } from "@/lib/domain/types";
import * as repo from "@/lib/db/repo";
import { ensureSeed } from "@/lib/db/seed";

/* ---------- weather memo (the composer previews on every pause in speech) ---------- */

const wxMemo = new Map<string, { at: number; value: WeatherEvidence | null }>();
async function siteWeather(project: Project | null, date: string): Promise<WeatherEvidence | null> {
  if (!project || project.lat === null || project.lon === null) return null;
  const key = `${project.lat.toFixed(2)},${project.lon.toFixed(2)},${date}`;
  const hit = wxMemo.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const value = await fetchSiteWeather(project.lat, project.lon, date);
  wxMemo.set(key, { at: Date.now(), value });
  return value;
}

/* ---------- live preview (nothing is stored) ---------- */

export interface Preview extends ExtractResult {
  evidence: EntryEvidence;
  weather: WeatherEvidence | null;
  weatherNotes: string[];
  weatherVerdicts: WeatherVerdict[];
}

export async function previewExtraction(args: {
  transcript: string;
  logDate: string;
  photos: number;
  projectId?: string;
  cfg?: AiConfig | null;
}): Promise<Preview> {
  const project = args.projectId ? repo.getProject(args.projectId) : null;
  const [result, weather] = await Promise.all([extract(args.transcript, args.logDate, args.cfg), siteWeather(project, args.logDate)]);
  const judgements = result.extraction.events.map((e) => judgeWeatherEvent(e, weather));
  const evidence = evaluateEntry(result.extraction, args.transcript, {
    photos: args.photos,
    logDate: args.logDate,
    recordedOn: todayLocal(),
    weatherVerdicts: judgements.map((j) => j.verdict),
  });
  return { ...result, evidence, weather, weatherNotes: judgements.map((j) => j.explanation), weatherVerdicts: judgements.map((j) => j.verdict) };
}

/* ---------- sealing ---------- */

export interface SealInput {
  logDate: string;
  author: string;
  transcript: string;
  source: "voice" | "text";
  attachments: Attachment[];
  addendumOf: string | null;
}

export async function sealLog(
  projectId: string,
  input: SealInput,
  opts: { createdAt?: string; forceLocal?: boolean; weather?: WeatherEvidence | null; cfg?: AiConfig | null } = {},
): Promise<{ entry: LogEntry; evaluation: LogEvaluation; note?: string }> {
  const project = repo.getProject(projectId);
  if (!project) throw new Error("Project not found");

  let extraction: Extraction;
  let provider: SealedContent["provider"];
  let note: string | undefined;
  if (opts.forceLocal) {
    extraction = extractLocal(input.transcript);
    provider = { name: "local", model: null };
  } else {
    const r = await extract(input.transcript, input.logDate, opts.cfg);
    extraction = r.extraction;
    provider = r.provider;
    note = r.note;
  }

  const weather = opts.weather !== undefined ? opts.weather : await siteWeather(project, input.logDate);
  const content: SealedContent = {
    logDate: input.logDate,
    author: input.author,
    source: input.source,
    transcript: input.transcript,
    structured: extraction,
    attachments: input.attachments,
    weather,
    provider,
    addendumOf: input.addendumOf,
  };

  const createdAt = opts.createdAt ?? new Date().toISOString();
  const evaluation = evaluateLog({ content, createdAt });
  const entry = repo.insertLog({ projectId, createdAt, content, score: evaluation.evidence.score });
  return { entry, evaluation, note };
}

/* ---------- read models ---------- */

export interface ProjectOverview {
  project: Project;
  logCount: number;
  events: EventRecord[];
  delayHours: number;
  avgScore: number;
  chain: ChainResult;
  lastLogDate: string | null;
  openNotices: number;
  urgentNotices: number;
  overdueNotices: number;
  nextDeadline: { event: EventRecord; daysLeft: number } | null;
}

export function overview(projectId: string, today = todayLocal()): ProjectOverview | null {
  const project = repo.getProject(projectId);
  if (!project) return null;
  const logs = repo.listLogs(projectId);
  const events = repo.listEvents(projectId);
  const chain = repo.verifyProjectChain(projectId);

  let open = 0, urgent = 0, overdue = 0;
  let next: ProjectOverview["nextDeadline"] = null;
  for (const e of events) {
    const clock = noticeClock(e.noticeDueOn, today, e.noticeStatus);
    if (!clock) continue;
    if (clock.state === "overdue") { overdue++; open++; }
    else if (["due_today", "critical", "soon", "open"].includes(clock.state)) {
      open++;
      if (clock.state !== "open") urgent++;
      if (!next || clock.daysLeft < next.daysLeft) next = { event: e, daysLeft: clock.daysLeft };
    }
  }
  if (!next && overdue) {
    const worst = events
      .filter((e) => noticeClock(e.noticeDueOn, today, e.noticeStatus)?.state === "overdue")
      .sort((a, b) => (a.noticeDueOn! < b.noticeDueOn! ? -1 : 1))[0];
    if (worst) next = { event: worst, daysLeft: noticeClock(worst.noticeDueOn, today, worst.noticeStatus)!.daysLeft };
  }

  return {
    project,
    logCount: logs.length,
    events,
    delayHours: events.filter((e) => e.kind === "delay").reduce((s, e) => s + (e.hoursLost ?? 0), 0),
    avgScore: logs.length ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0,
    chain,
    lastLogDate: logs.length ? logs[logs.length - 1].content.logDate : null,
    openNotices: open,
    urgentNotices: urgent,
    overdueNotices: overdue,
    nextDeadline: next,
  };
}

export async function portfolio(today = todayLocal()): Promise<ProjectOverview[]> {
  await ensureSeed();
  return repo
    .listProjects()
    .map((p) => overview(p.id, today)!)
    .sort((a, b) => b.overdueNotices - a.overdueNotices || b.urgentNotices - a.urgentNotices);
}

export function sortedNotices(events: EventRecord[], today = todayLocal()) {
  return events
    .filter((e) => e.noticeDueOn)
    .map((e) => ({ event: e, clock: noticeClock(e.noticeDueOn, today, e.noticeStatus)! }))
    .sort((a, b) => {
      const ua = URGENCY_ORDER.indexOf(a.clock.state);
      const ub = URGENCY_ORDER.indexOf(b.clock.state);
      return ua - ub || a.clock.daysLeft - b.clock.daysLeft;
    });
}
