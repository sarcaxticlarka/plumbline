import { notFound } from "next/navigation";
import { Download, ShieldAlert, ShieldCheck } from "lucide-react";
import * as repo from "@/lib/db/repo";
import { pageProject } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { integrity } from "@/lib/anchor/service";
import { formatDate, todayLocal } from "@/lib/domain/dates";
import { noticeClock, describeClock } from "@/lib/domain/notice";
import { CAUSE_LABEL, KIND_LABEL, PARTY_LABEL, WEATHER_STYLE, cn, shortHash } from "@/lib/format";
import { PrintButton } from "@/components/app/PrintButton";

export const metadata = { title: "Claim packet" };

export default async function Packet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, project } = await pageProject(id);
  const logs = repo.listLogs(id);
  const events = repo.listEvents(id);
  const integ = integrity(id);
  const chain = integ.chain;
  const anchorsOk = integ.anchors.filter((a) => a.ok);
  const anchorBad = integ.anchors.find((a) => !a.ok);
  const today = todayLocal();

  const delays = events.filter((e) => e.kind === "delay");
  const totalHours = delays.reduce((s, e) => s + (e.hoursLost ?? 0), 0);
  const by = (key: "cause" | "responsibleParty") => {
    const m = new Map<string, number>();
    delays.forEach((e) => m.set(e[key], (m.get(e[key]) ?? 0) + (e.hoursLost ?? 0)));
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const byCause = by("cause");
  const byParty = by("responsibleParty");
  const max = Math.max(1, ...byCause.map(([, h]) => h), ...byParty.map(([, h]) => h));
  const avg = logs.length ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0;
  const corroborated = delays.filter((e) => e.weatherVerdict === "corroborated").length;
  const weatherDelays = delays.filter((e) => e.cause === "weather").length;

  const Bar = ({ label, h, tone }: { label: string; h: number; tone: string }) => (
    <div className="grid grid-cols-[150px_1fr_46px] items-center gap-3 text-[13.5px]">
      <span className="truncate text-ink-2">{label}</span>
      <span className="h-3 rounded-full bg-paper-2"><span className={cn("block h-full rounded-full", tone)} style={{ width: `${(h / max) * 100}%` }} /></span>
      <b className="text-right tabular-nums">{h} h</b>
    </div>
  );

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-mute">A print-ready chronology of every claim-relevant event, its evidence, and the integrity of the record behind it.</p>
        <div className="flex flex-wrap gap-2">
          {can(role, "export") && <><a href={`/api/projects/${id}/export?format=csv`} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 text-[13px] font-medium hover:border-ink/40"><Download className="h-3.5 w-3.5" /> CSV</a>
          <a href={`/api/projects/${id}/export?format=md`} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 text-[13px] font-medium hover:border-ink/40"><Download className="h-3.5 w-3.5" /> Markdown</a></>}
          <PrintButton />
        </div>
      </div>

      <article className="print-page theme-paper mx-auto max-w-[900px] border border-line p-8 md:p-14">
        <header className="border-b-2 border-ink pb-6">
          <div className="label">Delay &amp; event record</div>
          <h1 className="serif mt-2 text-[40px] leading-[1.05]">{project.name}</h1>
          <div className="mt-3 grid gap-x-8 gap-y-1 text-[13.5px] text-ink-2 sm:grid-cols-2">
            {project.address && <div><span className="text-mute">Site:</span> {project.address}</div>}
            {project.contractRef && <div><span className="text-mute">Contract:</span> {project.contractRef}</div>}
            {project.client && <div><span className="text-mute">Owner:</span> {project.client}</div>}
            {project.contractor && <div><span className="text-mute">Contractor:</span> {project.contractor}</div>}
            <div><span className="text-mute">Prepared:</span> {formatDate(today, { month: "long", day: "numeric", year: "numeric" })}</div>
            <div><span className="text-mute">Period:</span> {logs.length ? `${formatDate(logs[0].content.logDate, { month: "short", day: "numeric" })} – ${formatDate(logs[logs.length - 1].content.logDate, { month: "short", day: "numeric", year: "numeric" })}` : "—"}</div>
          </div>
        </header>

        <section className={cn("mt-6 flex items-start gap-3 rounded-xl border p-4", chain.ok ? "border-ok/40 bg-ok-soft/60" : "border-bad/50 bg-bad-soft")}>
          {chain.ok ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-bad" />}
          <div className="text-[13.5px] leading-relaxed">
            {chain.ok ? (
              <>
                <b className="text-ok">Record integrity verified.</b> All {chain.checked} daily-log entries match their SHA-256 seals and link in an unbroken chain. Chain head: <span className="hash break-all">{chain.headHash}</span>
              </>
            ) : (
              <>
                <b className="text-bad">Record integrity check FAILED at entry #{chain.brokenAtSeq}.</b> {chain.reason} Treat entries from #{chain.brokenAtSeq} onward as unverified.
              </>
            )}
          </div>
        </section>

        <section className={cn("mt-3 border p-4 text-[13.5px] leading-relaxed", anchorBad ? "border-bad/50 bg-bad-soft" : anchorsOk.length ? "border-ok/40 bg-ok-soft/60" : "border-line")}>
          {anchorBad ? (
            <><b className="text-bad">External anchor MISMATCH.</b> {anchorBad.reason}</>
          ) : anchorsOk.length ? (
            <>
              <b className="text-ok">Externally anchored.</b> {anchorsOk.map((a) => a.kind === "rfc3161" ? `Entry #${a.headSeq} was timestamped by an independent RFC 3161 authority (${a.detail.genTime ?? "time recorded"})` : `The chain head at entry #${a.headSeq} was emailed to ${String(a.detail.to ?? "the owner’s rep")} on ${formatDate(a.createdAt.slice(0, 10))}`).join("; ")}. These copies exist outside the system; each still matches the log above.
            </>
          ) : (
            <><b>Not externally anchored.</b> The chain is internally consistent, but no independent timestamp or emailed fingerprint exists yet, so a privileged operator could in theory have rewritten the whole chain.</>
          )}
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Daily logs", logs.length],
            ["Claim events", events.length],
            ["Recorded delay hours", totalHours],
            ["Avg evidence", `${avg}`],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-line p-4"><div className="serif text-[40px] leading-none">{v}</div><div className="label mt-2 !text-[10px]">{l}</div></div>
          ))}
        </section>
        {weatherDelays > 0 && (
          <p className="mt-3 text-[13px] text-ink-2">{corroborated} of {weatherDelays} weather delays are corroborated by measured site weather (Open-Meteo); the rest are flagged for follow-up in the chronology.</p>
        )}

        {delays.length > 0 && (
          <section className="mt-9 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="label mb-4">Delay hours by cause</h2>
              <div className="space-y-2.5">{byCause.map(([k, h]) => <Bar key={k} label={CAUSE_LABEL[k as keyof typeof CAUSE_LABEL]} h={h} tone="bg-ink" />)}</div>
            </div>
            <div>
              <h2 className="label mb-4">Delay hours by responsible party</h2>
              <div className="space-y-2.5">{byParty.map(([k, h]) => <Bar key={k} label={PARTY_LABEL[k as keyof typeof PARTY_LABEL]} h={h} tone="bg-blue" />)}</div>
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="label mb-3">Chronology</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink text-[11px] uppercase tracking-wider text-mute">
                  <th className="py-2 pr-3">Date</th><th className="pr-3">Event</th><th className="pr-3">Cause / party</th><th className="pr-3 text-right">Hours</th><th className="pr-3">Corroboration</th><th className="pr-3 text-right">Evid.</th><th>Notice</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const clock = noticeClock(e.noticeDueOn, today, e.noticeStatus);
                  const wv = WEATHER_STYLE[e.weatherVerdict];
                  return (
                    <tr key={e.id} className="break-inside-avoid border-b border-line align-top">
                      <td className="py-3 pr-3 whitespace-nowrap">{formatDate(e.occurredOn, { month: "short", day: "numeric" })}<div className="hash text-mute">#{e.logSeq}</div></td>
                      <td className="pr-3"><div className="font-medium">{e.title}</div><div className="text-mute">{KIND_LABEL[e.kind]}</div>{e.quote && <div className="mt-1 italic text-ink-2">“{e.quote}”</div>}</td>
                      <td className="pr-3">{CAUSE_LABEL[e.cause]}<div className="text-mute">{PARTY_LABEL[e.responsibleParty]}</div></td>
                      <td className="pr-3 text-right tabular-nums">{e.hoursLost ?? "—"}</td>
                      <td className="pr-3">{wv.label || (e.criticalPathLikely ? "Critical path flagged" : "—")}</td>
                      <td className="pr-3 text-right tabular-nums">{e.evidenceScore}</td>
                      <td>{clock ? <>{describeClock(clock)}<div className="text-mute">due {formatDate(e.noticeDueOn!, { month: "short", day: "numeric" })}</div></> : "n/a"}</td>
                    </tr>
                  );
                })}
                {events.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-mute">No claim-relevant events recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 break-inside-avoid">
          <h2 className="label mb-3">Appendix — sealed log register</h2>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead><tr className="border-b-2 border-ink text-[11px] uppercase tracking-wider text-mute"><th className="py-2">#</th><th>Date</th><th>Author</th><th>Logged</th><th className="text-right">Evid.</th><th>SHA-256</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-line">
                  <td className="py-2">{l.seq}</td><td>{formatDate(l.content.logDate, { month: "short", day: "numeric" })}</td><td>{l.content.author}</td>
                  <td>{todayLocal(new Date(l.createdAt)) > l.content.logDate ? "late" : "same day"}</td><td className="text-right tabular-nums">{l.score}</td><td className="hash">{shortHash(l.hash, 14)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-10 border-t border-line pt-4 text-[11.5px] leading-relaxed text-mute">
          Generated by Plumbline from contemporaneous daily-log entries. Evidence scores and weather corroboration are decision aids, not legal conclusions. Notice
          periods and required formats vary by contract and jurisdiction; confirm with counsel before relying on this document in a dispute.
        </footer>
      </article>
    </div>
  );
}
