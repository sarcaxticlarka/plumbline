import type { EventRecord, LogEntry, NoticeStatus, Project, WeatherVerdict } from "./types";
import { evaluateEntry, type EntryEvidence } from "./evidence";
import { noticeDueOn, requiresNotice } from "./notice";
import { todayLocal } from "./dates";
import { judgeWeatherEvent } from "@/lib/weather/thresholds";

export const eventId = (logId: string, index: number) => `${logId}:${index}`;

export interface LogEvaluation {
  evidence: EntryEvidence;
  weatherVerdicts: WeatherVerdict[];
  weatherNotes: string[];
}

/** Evidence is always derived from the sealed content, so it cannot drift from the record. */
export function evaluateLog(log: Pick<LogEntry, "content" | "createdAt">): LogEvaluation {
  const c = log.content;
  const judgements = c.structured.events.map((e) => judgeWeatherEvent(e, c.weather));
  const evidence = evaluateEntry(c.structured, c.transcript, {
    photos: c.attachments.filter((a) => a.mime.startsWith("image/")).length,
    logDate: c.logDate,
    recordedOn: todayLocal(new Date(c.capturedAt ?? log.createdAt)),
    weatherVerdicts: judgements.map((j) => j.verdict),
  });
  return { evidence, weatherVerdicts: judgements.map((j) => j.verdict), weatherNotes: judgements.map((j) => j.explanation) };
}

export interface NoticeRow {
  status: NoticeStatus;
  sentOn: string | null;
}

/**
 * Event rows are projections of sealed log content plus mutable notice state.
 * Only `noticeStatus` / `noticeSentOn` live outside the seal — they record what the user did, not what happened.
 */
export function buildEventRecords(project: Project, logs: LogEntry[], notices: Map<string, NoticeRow>): EventRecord[] {
  const out: EventRecord[] = [];
  for (const log of logs) {
    const ev = evaluateLog(log);
    log.content.structured.events.forEach((e, index) => {
      const id = eventId(log.id, index);
      const n = notices.get(id);
      out.push({
        id,
        projectId: project.id,
        logId: log.id,
        logSeq: log.seq,
        index,
        kind: e.kind,
        title: e.title,
        description: e.description,
        cause: e.cause,
        hoursLost: e.hoursLost,
        tradesAffected: e.tradesAffected,
        responsibleParty: e.responsibleParty,
        criticalPathLikely: e.criticalPathLikely,
        quote: e.quote,
        occurredOn: log.content.logDate,
        noticeDueOn: requiresNotice(e.kind) ? noticeDueOn(e.kind, log.content.logDate, project.rules) : null,
        noticeStatus: requiresNotice(e.kind) ? (n?.status ?? "open") : "waived",
        noticeSentOn: n?.sentOn ?? null,
        evidenceScore: ev.evidence.eventScores[index]?.score ?? 0,
        weatherVerdict: ev.weatherVerdicts[index] ?? "not_applicable",
      });
    });
  }
  return out;
}
