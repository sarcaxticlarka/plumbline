import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Mic, CloudOff, Check, CloudCheck, CloudAlert, Cloud, Cpu, Link2, ShieldCheck, X } from "lucide-react";
import * as repo from "@/lib/db/repo";
import { pageProject } from "@/lib/auth/guards";
import { computeHash } from "@/lib/domain/chain";
import { evaluateLog } from "@/lib/domain/events";
import { formatDate, todayLocal } from "@/lib/domain/dates";
import { scoreLabel } from "@/lib/domain/evidence";
import { judgeWeatherEvent } from "@/lib/weather/thresholds";
import { providerLabel, CAUSE_LABEL, KIND_LABEL, PARTY_LABEL, cn, shortHash } from "@/lib/format";
import { Pill, ScoreRing } from "@/components/ui";
import { CopyButton } from "@/components/app/CopyButton";

export const metadata = { title: "Log entry" };

function highlight(text: string, quotes: string[]) {
  const marks: [number, number][] = [];
  for (const q of quotes) {
    if (!q) continue;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i >= 0) marks.push([i, i + q.length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([s, e], k) => {
    if (s < at) return;
    out.push(text.slice(at, s));
    out.push(<mark key={k} className="rounded bg-safety-soft px-0.5 text-ink [box-decoration-break:clone]">{text.slice(s, e)}</mark>);
    at = e;
  });
  out.push(text.slice(at));
  return out;
}

export default async function LogDetail({ params }: { params: Promise<{ id: string; logId: string }> }) {
  const { id, logId } = await params;
  await pageProject(id);
  const log = repo.getLog(logId);
  if (!log || log.projectId !== id) notFound();
  const logs = repo.listLogs(id);
  const idx = logs.findIndex((l) => l.id === log.id);
  const prev = logs[idx - 1], next = logs[idx + 1];
  const c = log.content;
  const x = c.structured;
  const ev = evaluateLog(log);
  const lab = scoreLabel(log.score);
  const recomputed = computeHash({ seq: log.seq, projectId: log.projectId, createdAt: log.createdAt, prevHash: log.prevHash, content: c });
  const intact = recomputed === log.hash;
  const late = todayLocal(new Date(c.capturedAt ?? log.createdAt)) > c.logDate;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/projects/${id}`} className="flex items-center gap-2 text-[14px] text-mute hover:text-ink"><ArrowLeft className="h-4 w-4" /> Logbook</Link>
        <div className="flex gap-2">
          {prev && <Link href={`/app/projects/${id}/logs/${prev.id}`} className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] hover:border-ink/40"><ArrowLeft className="h-3.5 w-3.5" /> #{prev.seq}</Link>}
          {next && <Link href={`/app/projects/${id}/logs/${next.id}`} className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] hover:border-ink/40">#{next.seq} <ArrowRight className="h-3.5 w-3.5" /></Link>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing score={log.score} size={96} stroke={9} label />
        <div>
          <div className="label">Entry #{log.seq} · recorded by {c.author}</div>
          <h2 className="serif mt-1 text-[clamp(32px,4vw,48px)] leading-none">{formatDate(c.logDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill className={lab.tone === "good" ? "bg-ok-soft text-ok" : lab.tone === "ok" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad"}>{lab.label} evidence</Pill>
            <Pill className={late ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}>{late ? `Logged ${formatDate(todayLocal(new Date(c.capturedAt ?? log.createdAt)), { month: "short", day: "numeric" })} — not same-day` : "Logged the same day"}</Pill>
            {c.capturedAt && <Pill className="bg-warn-soft text-warn"><CloudOff className="h-3 w-3" /> Captured offline {new Date(c.capturedAt).toLocaleString()} · sealed {new Date(log.createdAt).toLocaleString()} (device clock)</Pill>}
            <Pill className="bg-paper-2 text-ink-2">{c.source === "voice" ? "Dictated" : "Typed / dictated into text"}</Pill>
            <Pill className="bg-paper-2 text-ink-2"><Cpu className="h-3 w-3" />{providerLabel(c.provider)}</Pill>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-6">
            <div className="label mb-3">Transcript — as recorded</div>
            <p className="whitespace-pre-wrap text-[16px] leading-[1.75] text-ink-2">{highlight(c.transcript, x.events.map((e) => e.quote))}</p>
            <p className="mt-4 text-[12.5px] text-mute"><mark className="rounded bg-safety-soft px-1">Highlighted</mark> phrases are the verbatim quotes supporting each claim event.</p>
          </section>

          <section className="surface p-6">
            <div className="label mb-4">Claim events</div>
            {x.events.length === 0 && <p className="text-[14.5px] text-mute">No delays, changes or differing conditions were reported.</p>}
            <div className="space-y-5">
              {ev.evidence.eventScores.map((es, i) => {
                const e = x.events[i];
                const wj = judgeWeatherEvent(e, c.weather);
                return (
                  <div key={i} className="rounded-2xl border border-line p-4">
                    <div className="flex items-start gap-4">
                      <ScoreRing score={es.score} size={56} stroke={6} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><Pill className="bg-safety-soft text-safety">{KIND_LABEL[e.kind]}</Pill><b className="text-[16px]">{e.title}</b></div>
                        <p className="mt-1.5 text-[14px] text-ink-2">{e.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Pill className="bg-paper-2 text-ink-2">{CAUSE_LABEL[e.cause]}</Pill>
                          <Pill className="bg-paper-2 text-ink-2">{e.hoursLost !== null ? `${e.hoursLost} h lost` : "hours not stated"}</Pill>
                          <Pill className="bg-paper-2 text-ink-2">{PARTY_LABEL[e.responsibleParty]}</Pill>
                          {e.tradesAffected.map((t) => <Pill key={t} className="bg-paper-2 text-ink-2">{t}</Pill>)}
                        </div>
                      </div>
                    </div>
                    <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                      {es.checks.map((k) => (
                        <li key={k.key} className="flex items-start gap-2 text-[13px]">
                          <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", k.ok ? "bg-ok text-black" : "bg-ink/10 text-mute")}>{k.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <X className="h-2.5 w-2.5" strokeWidth={3} />}</span>
                          <span className={k.ok ? "text-ink-2" : "text-mute"}>{k.ok ? k.label : <>{k.label} — <i>{k.hint}</i></>}</span>
                        </li>
                      ))}
                    </ul>
                    {wj.verdict !== "not_applicable" && (
                      <div className={cn("mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]", wj.verdict === "corroborated" ? "bg-ok-soft text-ok" : wj.verdict === "not_supported" ? "bg-warn-soft text-warn" : "bg-paper-2 text-mute")}>
                        {wj.verdict === "corroborated" ? <CloudCheck className="mt-0.5 h-4 w-4 shrink-0" /> : wj.verdict === "not_supported" ? <CloudAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <Cloud className="mt-0.5 h-4 w-4 shrink-0" />}
                        {wj.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface p-6">
            <div className="label mb-3">Site record</div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div><dt className="label !text-[10px]">Manpower</dt><dd className="mt-1 font-medium">{x.manpower.reduce((s, m) => s + m.headcount, 0) || "—"}</dd><dd className="text-[12.5px] text-mute">{x.manpower.map((m) => `${m.headcount} ${m.trade}`).join(" · ") || "not recorded"}</dd></div>
              <div><dt className="label !text-[10px]">Equipment</dt><dd className="mt-1 text-[13.5px]">{x.equipment.map((e) => `${e.name} (${e.status})`).join(", ") || "—"}</dd></div>
              <div className="col-span-2"><dt className="label !text-[10px]">Work performed</dt><dd className="mt-1 space-y-1 text-[13.5px] text-ink-2">{x.work.length ? x.work.map((w, i) => <div key={i}>{w.area && <span className="hash mr-2 rounded bg-paper-2 px-1.5 py-0.5 text-[11px] uppercase">{w.area}</span>}{w.activity}</div>) : "—"}</dd></div>
              <div><dt className="label !text-[10px]">Deliveries</dt><dd className="mt-1 text-[13.5px]">{x.deliveries.map((d) => `${d.item} (${d.status})`).join(", ") || "—"}</dd></div>
              <div><dt className="label !text-[10px]">Inspections</dt><dd className="mt-1 text-[13.5px]">{x.inspections.map((d) => `${d.type}: ${d.result}`).join(", ") || "—"}</dd></div>
              <div className="col-span-2"><dt className="label !text-[10px]">Safety</dt><dd className="mt-1 text-[13.5px]">{x.safety.map((s) => s.description).join(" · ") || "—"}</dd></div>
              {x.openItems.length > 0 && <div className="col-span-2"><dt className="label !text-[10px]">Open items</dt><dd className="mt-1 text-[13.5px] text-ink-2">{x.openItems.join(" · ")}</dd></div>}
            </dl>
          </section>

          {c.weather && (
            <section className="surface p-6">
              <div className="label mb-3">Measured weather · Open-Meteo</div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  ["Rain", c.weather.precipitationMm, "mm"],
                  ["Max gust", c.weather.windMaxKmh, "km/h"],
                  ["High", c.weather.tempMaxC, "°C"],
                  ["Low", c.weather.tempMinC, "°C"],
                ].map(([l, v, u]) => (
                  <div key={l as string} className="rounded-xl bg-paper-2 p-3"><div className="serif text-[28px] leading-none">{v === null ? "—" : Math.round((v as number) * 10) / 10}</div><div className="label mt-1 !text-[9px]">{l} · {u}</div></div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-mute">Fetched {formatDate(c.weather.fetchedAt.slice(0, 10))} and sealed with the entry, so later revisions upstream can’t change the evidence.</p>
            </section>
          )}

          {c.attachments.some((a) => a.mime.startsWith("audio/")) && (
            <section className="surface p-6">
              <div className="label mb-3 flex items-center gap-1.5"><Mic className="h-3 w-3" /> Original audio · sealed</div>
              <div className="space-y-4">
                {c.attachments.filter((a) => a.mime.startsWith("audio/")).map((a) => (
                  <div key={a.sha256}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls preload="none" src={`/api/uploads/${a.sha256}`} className="w-full" />
                    <div className="hash mt-2 flex items-center gap-2 break-all text-mute">SHA-256 {a.sha256}<CopyButton value={a.sha256} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-mute">The recording’s hash is part of this entry’s seal: swapping or trimming the audio breaks the chain.</p>
            </section>
          )}

          {c.attachments.some((a) => a.mime.startsWith("image/")) && (
            <section className="surface p-6">
              <div className="label mb-3 flex items-center gap-1.5"><Camera className="h-3 w-3" /> Photos · {c.attachments.filter((a) => a.mime.startsWith("image/")).length}</div>
              <div className="grid grid-cols-3 gap-2">
                {c.attachments.filter((a) => a.mime.startsWith("image/")).map((a) => (
                  <a key={a.sha256} href={`/api/uploads/${a.sha256}`} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${a.sha256}`} alt={a.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    <span className="hash absolute inset-x-0 bottom-0 bg-black/75 text-center text-[9px] text-white">{a.sha256.slice(0, 10)}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className={cn("surface p-6", intact ? "border-ok/30" : "border-bad/50")}>
            <div className="flex items-center justify-between">
              <div className="label flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Seal</div>
              <Pill className={intact ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}><ShieldCheck className="h-3.5 w-3.5" />{intact ? "Matches its seal" : "Content changed after sealing"}</Pill>
            </div>
            <dl className="mt-4 space-y-3">
              {[
                ["SHA-256", log.hash],
                ["Previous entry", log.prevHash],
                ["Sealed at", log.createdAt],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label !text-[10px]">{k}</dt>
                  <dd className="hash mt-1 flex items-center gap-2 break-all text-ink-2">{v}{k === "SHA-256" && <CopyButton value={log.hash} />}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12.5px] leading-relaxed text-mute">Anyone can recompute this hash from the entry’s content: <span className="hash">SHA-256(seq | project | time | previous hash | canonical JSON)</span>. Short form: {shortHash(log.hash, 12)}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
