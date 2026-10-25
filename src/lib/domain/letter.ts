import type { EventRecord, LogEntry, Project } from "./types";
import { formatDate } from "./dates";
import { noticeWindowDays } from "./notice";
import { judgeWeatherEvent } from "@/lib/weather/thresholds";

const KIND_NOUN: Record<EventRecord["kind"], string> = {
  delay: "Delay",
  change: "Change in the Work",
  differing_condition: "Differing Site Condition",
  owner_direction: "Directive / Change in the Work",
  rfi: "Request for Information",
};

const PARTY_LABEL: Record<EventRecord["responsibleParty"], string> = {
  owner: "the Owner",
  architect: "the Architect / Engineer",
  gc: "the General Contractor",
  subcontractor: "a subcontractor",
  supplier: "a supplier",
  utility: "a utility provider",
  authority: "the authority having jurisdiction",
  weather: "weather (excusable, non-compensable by default)",
  unknown: "not yet determined",
};

export interface Letter {
  subject: string;
  body: string;
}

/**
 * Deterministic notice draft. The facts come from the sealed record; the legal framing is intentionally plain,
 * neutral and carries a reservation of rights. It is a starting point for review, never legal advice.
 */
export function generateNoticeLetter(args: {
  project: Project;
  event: EventRecord;
  log: LogEntry;
  today: string;
  sealedHash: string;
}): Letter {
  const { project, event, log, today, sealedHash } = args;
  const c = log.content;
  const noun = KIND_NOUN[event.kind];
  const window = noticeWindowDays(event.kind, project.rules);
  const weather = c.weather ? judgeWeatherEvent(c.structured.events[event.index], c.weather) : null;

  const lines: string[] = [];
  lines.push(formatDate(today, { month: "long", day: "numeric", year: "numeric" }));
  lines.push("");
  lines.push(`To: ${project.client || "[Owner / Owner's Representative]"}`);
  lines.push(`From: ${project.contractor || "[Contractor]"}`);
  lines.push(`Project: ${project.name}${project.address ? ` — ${project.address}` : ""}`);
  if (project.contractRef) lines.push(`Contract: ${project.contractRef}`);
  lines.push("");
  lines.push(`RE: Written notice of ${noun.toLowerCase()} — ${event.title}`);
  lines.push("");
  lines.push(
    `This letter is written notice that on ${formatDate(event.occurredOn, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} the following occurred on the Project:`,
  );
  lines.push("");
  lines.push(event.description);
  lines.push("");
  lines.push("Facts recorded at the time:");
  lines.push(`  • Source: daily log entry #${log.seq}, recorded by ${c.author}${event.quote ? `: “${event.quote}”` : "."}`);
  lines.push(`  • Cause: ${event.cause.replace(/_/g, " ")}. Party responsible: ${PARTY_LABEL[event.responsibleParty]}.`);
  if (event.hoursLost !== null) lines.push(`  • Impact recorded: approximately ${event.hoursLost} work hours lost on the day.`);
  if (event.tradesAffected.length) lines.push(`  • Trades / activities affected: ${event.tradesAffected.join(", ")}.`);
  if (weather && weather.verdict !== "not_applicable") lines.push(`  • Weather record: ${weather.explanation}`);
  if (c.attachments.length) lines.push(`  • Photographs attached to the record: ${c.attachments.length}.`);
  lines.push("");
  lines.push(
    event.criticalPathLikely
      ? "This event may affect the critical path of the Work. The schedule impact is being analysed and will be provided."
      : "The schedule and cost impact of this event is being evaluated and will be provided as it becomes known.",
  );
  lines.push("");
  lines.push(
    "The Contractor reserves all rights under the Contract, including the right to request an adjustment of the Contract Time and/or Contract Sum, and to supplement this notice as additional information becomes available.",
  );
  lines.push("");
  lines.push(
    `Record integrity: this notice is supported by Plumbline log entry #${log.seq}, sealed ${c.logDate === log.createdAt.slice(0, 10) ? "on the day of the event" : `on ${formatDate(log.createdAt.slice(0, 10))}`}, SHA-256 ${sealedHash}.`,
  );
  lines.push("");
  lines.push("Respectfully,");
  lines.push(c.author);
  lines.push(project.contractor || "[Contractor]");
  lines.push("");
  lines.push("— — —");
  lines.push(
    `DRAFT FOR REVIEW. This project is configured with a ${window}-day notice window for this event type; actual notice periods and required form vary by contract and jurisdiction. Confirm with your contract documents or counsel before sending.`,
  );

  return { subject: `Notice of ${noun} — ${event.title} — ${project.name}`, body: lines.join("\n") };
}
