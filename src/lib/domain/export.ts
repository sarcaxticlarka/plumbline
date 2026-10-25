import type { ChainResult, EventRecord, Project } from "./types";
import { addDays, formatDate } from "./dates";

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function delayRegisterCsv(events: EventRecord[]): string {
  const head = [
    "Log #", "Date", "Type", "Title", "Cause", "Responsible", "Hours lost", "Trades affected", "Critical path likely",
    "Evidence score", "Weather record", "Notice due", "Notice status", "Notice sent", "Recorded wording",
  ];
  const rows = events.map((e) => [
    e.logSeq, e.occurredOn, e.kind, e.title, e.cause, e.responsibleParty, e.hoursLost ?? "", e.tradesAffected.join("; "),
    e.criticalPathLikely ? "yes" : "no", e.evidenceScore, e.weatherVerdict, e.noticeDueOn ?? "", e.noticeStatus,
    e.noticeSentOn ?? "", e.quote,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** All-day calendar events on each open notice deadline, with a reminder three days before. */
export function noticeDeadlinesIcs(project: Project, events: EventRecord[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ymd = (d: string) => d.replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plumbline//Notice Clock//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    if (!e.noticeDueOn || e.noticeStatus !== "open") continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id.replace(/[^a-z0-9]/gi, "")}@plumbline`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.noticeDueOn)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(e.noticeDueOn, 1))}`,
      `SUMMARY:${esc(`NOTICE DUE — ${e.title} (${project.name})`)}`,
      `DESCRIPTION:${esc(`Event on ${e.occurredOn}. Log #${e.logSeq}. ${e.description}`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`Notice due in 3 days — ${e.title}`)}`,
      "TRIGGER:-P3D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function packetMarkdown(project: Project, events: EventRecord[], chain: ChainResult, logCount: number): string {
  const delays = events.filter((e) => e.kind === "delay");
  const hours = delays.reduce((s, e) => s + (e.hoursLost ?? 0), 0);
  const byCause = new Map<string, number>();
  delays.forEach((e) => byCause.set(e.cause, (byCause.get(e.cause) ?? 0) + (e.hoursLost ?? 0)));
  const out: string[] = [];
  out.push(`# Delay & Event Record — ${project.name}`);
  out.push("");
  out.push(`${project.address ? project.address + " · " : ""}${project.contractRef || "Contract ref not set"}`);
  out.push("");
  out.push(
    chain.ok
      ? `**Record integrity: VERIFIED.** ${chain.checked} sealed log entries; chain head \`${chain.headHash}\`.`
      : `**Record integrity: BROKEN at entry #${chain.brokenAtSeq}.** ${chain.reason}`,
  );
  out.push("");
  out.push(`## Summary`);
  out.push(`- ${logCount} daily logs · ${events.length} claim-relevant events · ${delays.length} delays · ${hours} recorded hours lost`);
  for (const [cause, h] of [...byCause].sort((a, b) => b[1] - a[1])) out.push(`- ${cause.replace(/_/g, " ")}: ${h} h`);
  out.push("");
  out.push(`## Chronology`);
  out.push("| Date | Event | Cause | Responsible | Hours | Evidence | Notice |");
  out.push("|---|---|---|---|---|---|---|");
  for (const e of events)
    out.push(
      `| ${formatDate(e.occurredOn)} | ${e.title} | ${e.cause.replace(/_/g, " ")} | ${e.responsibleParty} | ${e.hoursLost ?? "—"} | ${e.evidenceScore}% | ${e.noticeStatus}${e.noticeDueOn ? ` (due ${e.noticeDueOn})` : ""} |`,
    );
  out.push("");
  return out.join("\n");
}
