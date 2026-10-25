import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CloudCheck, CloudAlert, Clock3, Camera, Link2, Mic } from "lucide-react";
import * as repo from "@/lib/db/repo";
import { pageProject } from "@/lib/auth/guards";
import { evaluateLog } from "@/lib/domain/events";
import { addDays, diffDays, formatDate, todayLocal, toUtc } from "@/lib/domain/dates";
import { scoreLabel } from "@/lib/domain/evidence";
import { CAUSE_LABEL, KIND_LABEL, cn, shortHash } from "@/lib/format";
import { Pill, ScoreRing } from "@/components/ui";

export const metadata = { title: "Logbook" };

const KIND_CHIP: Record<string, string> = {
  delay: "bg-safety-soft text-safety",
  change: "bg-blue-soft text-blue",
  differing_condition: "bg-bad-soft text-bad",
  owner_direction: "bg-blue-soft text-blue",
  rfi: "bg-paper-2 text-ink-2",
};

/** Workdays with no sealed entry between the first log and yesterday — missing days weaken a record. */
function missingWorkdays(dates: string[], today: string): string[] {
  if (!dates.length) return [];
  const have = new Set(dates);
  const out: string[] = [];
  for (let d = [...dates].sort()[0]; diffDays(d, today) > 0; d = addDays(d, 1)) {
    const dow = new Date(toUtc(d)).getUTCDay();
    if (dow >= 1 && dow <= 5 && !have.has(d)) out.push(d);
  }
  return out.slice(-6);
}

export default async function Logbook({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageProject(id);
  const logs = repo.listLogs(id).reverse();
  const today = todayLocal();
  const missing = missingWorkdays(logs.map((l) => l.content.logDate), today);

  return (
    <div>
      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-3 border border-warn/40 bg-warn-soft p-4 text-warn">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-[14px]">
            <b>No log for {missing.map((d) => formatDate(d, { month: "short", day: "numeric" })).join(", ")}.</b>{" "}
            <span className="opacity-90">Gaps in daily records are the first thing an opposing party points to. Add a late entry — it is marked as non-contemporaneous, which is honest and still better than nothing.</span>
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="surface p-10 text-center">
          <div className="serif text-3xl">No entries yet</div>
          <p className="mx-auto mt-2 max-w-md text-mute">Dictate the first day on site. It takes about two minutes and starts the evidence record.</p>
        </div>
      )}

      {logs.map((l) => {
        const ev = evaluateLog(l);
        const c = l.content;
        const late = todayLocal(new Date(c.capturedAt ?? l.createdAt)) > c.logDate;
        const s = scoreLabel(l.score);
        const verdicts = ev.weatherVerdicts;
        return (
          <Link key={l.id} href={`/app/projects/${id}/logs/${l.id}`} className="group -mx-3 flex gap-5 border-b border-line px-3 py-6 transition-colors hover:bg-field md:gap-8">
            <div className="w-[84px] shrink-0 md:w-[110px]">
              <div className="label !text-[10px]">{formatDate(c.logDate, { weekday: "short" })} · #{l.seq}</div>
              <div className="cond tnum mt-2 text-[56px] leading-[0.8] transition-colors group-hover:text-safety md:text-[76px]">{formatDate(c.logDate, { day: "numeric" })}</div>
              <div className="label mt-1.5 !text-[10px]">{formatDate(c.logDate, { month: "short", year: "numeric" })}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-mute">
                <span>{c.author}</span>
                {late && <Pill className="bg-warn-soft text-warn"><Clock3 className="h-3 w-3" /> logged {formatDate(todayLocal(new Date(c.capturedAt ?? l.createdAt)), { month: "short", day: "numeric" })}</Pill>}
                {c.capturedAt && <Pill className="bg-warn-soft text-warn">captured offline</Pill>}
                {c.attachments.some((a) => a.mime.startsWith("image/")) && <Pill className="bg-paper-2 text-ink-2"><Camera className="h-3 w-3" /> {c.attachments.filter((a) => a.mime.startsWith("image/")).length}</Pill>}
                {c.attachments.some((a) => a.mime.startsWith("audio/")) && <Pill className="bg-paper-2 text-ink-2"><Mic className="h-3 w-3" /> audio sealed</Pill>}
              </div>
              <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-ink">{c.structured.summary}</p>
              {c.structured.events.length > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {c.structured.events.map((e, i) => (
                    <Pill key={i} className={KIND_CHIP[e.kind]}>
                      {KIND_LABEL[e.kind]} · {e.title.split(" — ")[0]}
                      {e.hoursLost !== null && ` · ${e.hoursLost}h`}
                      {verdicts[i] === "corroborated" && <CloudCheck className="h-3.5 w-3.5" />}
                      {verdicts[i] === "not_supported" && <CloudAlert className="h-3.5 w-3.5" />}
                    </Pill>
                  ))}
                </div>
              )}
              <div className="hash mt-3.5 flex items-center gap-1.5 text-mute">
                <Link2 className="h-3.5 w-3.5" />
                {shortHash(l.hash, 10)}
                <span className="opacity-60">← {shortHash(l.prevHash, 6)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <ScoreRing score={l.score} size={60} stroke={5} />
              <span className={cn("label !text-[9.5px]", s.tone === "good" ? "!text-ok" : s.tone === "ok" ? "!text-warn" : "!text-bad")}>{s.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
