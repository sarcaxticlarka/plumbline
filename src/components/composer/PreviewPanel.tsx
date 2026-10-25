"use client";
import { AnimatePresence, motion } from "motion/react";
import { Mic, CalendarClock, CloudCheck, CloudAlert, HardHat, MessageCircleQuestion, Sparkles, Truck, Wrench, ClipboardCheck, ShieldPlus, Users } from "lucide-react";
import type { Preview } from "@/lib/services";
import type { Gap, NoticeRules } from "@/lib/domain/types";
import { scoreLabel } from "@/lib/domain/evidence";
import { noticeDueOn } from "@/lib/domain/notice";
import { diffDays, formatDate, todayLocal } from "@/lib/domain/dates";
import { providerLabel, CAUSE_LABEL, KIND_LABEL, PARTY_LABEL, WEATHER_STYLE, cn } from "@/lib/format";
import { Pill, ScoreRing } from "@/components/ui";

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

function Section({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-2 flex items-center gap-1.5"><Icon className="h-3 w-3" />{title}</div>
      {children}
    </div>
  );
}

export function PreviewPanel({
  preview, loading, rules, logDate, onGap, tooShort, onGuide, guiding,
}: {
  onGuide?: () => void;
  guiding?: boolean;
  preview: Preview | null;
  loading: boolean;
  rules: NoticeRules;
  logDate: string;
  onGap: (g: Gap) => void;
  tooShort: boolean;
}) {
  if (!preview) {
    return (
      <div className="surface relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden p-10 text-center">
        <div className="blueprint absolute inset-0 opacity-70" />
        <div className="relative">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-safety-soft text-safety"><Sparkles className="h-6 w-6" /></div>
          <div className="serif mt-5 text-[30px] leading-tight">{tooShort ? "Start talking." : "Reading your entry…"}</div>
          <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-mute">
            As you dictate, Plumbline pulls out manpower, work, deliveries and every claim-relevant event — and asks for whatever a challenger would ask for.
          </p>
        </div>
      </div>
    );
  }

  const x = preview.extraction;
  const ev = preview.evidence;
  const lab = scoreLabel(ev.score);
  const today = todayLocal();
  const w = preview.weather;

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-70")}>
      {/* score header */}
      <div className="surface flex items-center gap-5 p-5">
        <ScoreRing score={ev.score} size={92} stroke={9} label />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("serif text-[30px] leading-none", lab.tone === "good" ? "text-ok" : lab.tone === "ok" ? "text-warn" : "text-bad")}>{lab.label}</span>
            {loading && <span className="shimmer h-2 w-16 rounded-full" />}
          </div>
          <p className="mt-1.5 text-[14px] text-ink-2">{x.summary || "—"}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Pill className="bg-paper-2 text-ink-2">{providerLabel(preview.provider)}</Pill>
            {w && (
              <Pill className="bg-blue-soft text-blue">
                Measured: {w.windMaxKmh !== null ? `${Math.round(w.windMaxKmh)} km/h gust` : "—"} · {w.precipitationMm !== null ? `${w.precipitationMm} mm rain` : "—"}
              </Pill>
            )}
          </div>
          {preview.note && <p className="mt-2 text-[12.5px] text-warn">{preview.note}</p>}
        </div>
      </div>

      {/* gaps */}
      <AnimatePresence initial={false}>
        {ev.gaps.length > 0 && (
          <motion.div key="gaps" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="surface border-warn/30 bg-warn-soft/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="label flex items-center gap-1.5 !text-warn"><MessageCircleQuestion className="h-3.5 w-3.5" /> Plumbline asks — tap to answer by voice</div>
              {onGuide && (
                <button onClick={onGuide} data-cursor className={cn("flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors", guiding ? "border-safety bg-safety text-on-safety" : "border-safety text-safety hover:bg-safety hover:text-on-safety")}>
                  <Mic className="h-3 w-3" /> {guiding ? "Guiding — stop" : "Guide me by voice"}
                </button>
              )}
            </div>
            <ul className="mt-3 space-y-1.5">
              {ev.gaps.slice(0, 6).map((g) => (
                <motion.li key={`${g.scope}-${g.eventIndex ?? "e"}-${g.key}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={spring}>
                  <button
                    onClick={() => onGap(g)}
                    className="group flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] transition-colors hover:bg-field"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", g.severity === "high" ? "bg-bad" : g.severity === "medium" ? "bg-warn" : "bg-mute")} />
                    <span className="flex-1 text-ink-2">
                      {g.scope === "event" && g.eventIndex !== undefined && <b className="mr-1.5 text-ink">{x.events[g.eventIndex]?.title.split(" — ")[0]}:</b>}
                      {g.question}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* events */}
      {x.events.length > 0 && (
        <div className="space-y-3">
          {x.events.map((e, i) => {
            const es = ev.eventScores[i];
            const due = noticeDueOn(e.kind, logDate, rules);
            const left = due ? diffDays(today, due) : null;
            const wv = preview.weatherNotes[i];
            const verdict = preview.weatherVerdicts[i] ?? "not_applicable";
            return (
              <motion.div key={`${e.title}-${i}`} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="surface p-5">
                <div className="flex items-start gap-4">
                  <ScoreRing score={es?.score ?? 0} size={54} stroke={6} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className={e.kind === "delay" ? "bg-safety-soft text-safety" : e.kind === "rfi" ? "bg-paper-2 text-ink-2" : "bg-blue-soft text-blue"}>{KIND_LABEL[e.kind]}</Pill>
                      <h4 className="text-[16px] font-semibold">{e.title}</h4>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill className="bg-paper-2 text-ink-2">{CAUSE_LABEL[e.cause]}</Pill>
                      <Pill className="bg-paper-2 text-ink-2">{e.hoursLost !== null ? `${e.hoursLost} h lost` : "hours not stated"}</Pill>
                      <Pill className="bg-paper-2 text-ink-2">{PARTY_LABEL[e.responsibleParty]}</Pill>
                      {e.criticalPathLikely && <Pill className="bg-bad-soft text-bad">Critical path?</Pill>}
                      {verdict !== "not_applicable" && (
                        <Pill className={WEATHER_STYLE[verdict as keyof typeof WEATHER_STYLE].chip}>
                          {verdict === "corroborated" ? <CloudCheck className="h-3.5 w-3.5" /> : <CloudAlert className="h-3.5 w-3.5" />}
                          {WEATHER_STYLE[verdict as keyof typeof WEATHER_STYLE].label}
                        </Pill>
                      )}
                    </div>
                    {e.quote && <p className="mt-3 border-l-2 border-safety/60 pl-3 text-[13.5px] italic text-ink-2">“{e.quote}”</p>}
                    {wv && e.cause === "weather" && <p className="mt-2 text-[12.5px] text-mute">{wv}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {due && (
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-safety">
                          <CalendarClock className="h-4 w-4" /> Notice due {formatDate(due, { month: "short", day: "numeric" })} · {left} day{left === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1" title="Evidence checks">
                        {es?.checks.map((c) => (
                          <span key={c.key} title={`${c.label}${c.ok ? " ✓" : " — missing"}`} className={cn("h-2 w-5 rounded-full", c.ok ? "bg-ok" : "bg-ink/15")} />
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* what was heard */}
      <div className="surface grid gap-5 p-5 sm:grid-cols-2">
        {x.manpower.length > 0 && (
          <Section icon={Users} title={`Manpower · ${x.manpower.reduce((s, m) => s + m.headcount, 0)}`}>
            <div className="flex flex-wrap gap-1.5">
              {x.manpower.map((m) => (
                <Pill key={m.trade} className="bg-paper-2 text-ink">
                  <b>{m.headcount}</b> {m.trade}
                  {m.company && <span className="text-mute">· {m.company}</span>}
                </Pill>
              ))}
            </div>
          </Section>
        )}
        {x.equipment.length > 0 && (
          <Section icon={Wrench} title="Equipment">
            <div className="flex flex-wrap gap-1.5">
              {x.equipment.map((m) => (
                <Pill key={m.name} className={m.status === "active" ? "bg-paper-2 text-ink" : "bg-warn-soft text-warn"}>
                  {m.count > 1 && <b>{m.count}</b>} {m.name} <span className="opacity-70">· {m.status}</span>
                </Pill>
              ))}
            </div>
          </Section>
        )}
        {x.work.length > 0 && (
          <Section icon={HardHat} title="Work performed">
            <ul className="space-y-1.5 text-[13.5px] text-ink-2">
              {x.work.slice(0, 4).map((wk, i) => (
                <li key={i} className="flex gap-2">
                  {wk.area && <span className="hash shrink-0 rounded bg-paper-2 px-1.5 py-0.5 text-[11px] uppercase">{wk.area}</span>}
                  <span>{wk.activity}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {x.deliveries.length > 0 && (
          <Section icon={Truck} title="Deliveries">
            <ul className="space-y-1 text-[13.5px] text-ink-2">
              {x.deliveries.map((d, i) => (
                <li key={i}>{d.item}{d.supplier && ` · ${d.supplier}`} <Pill className={d.status === "late" || d.status === "rejected" ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}>{d.status}</Pill></li>
              ))}
            </ul>
          </Section>
        )}
        {x.inspections.length > 0 && (
          <Section icon={ClipboardCheck} title="Inspections">
            <ul className="space-y-1 text-[13.5px] text-ink-2">
              {x.inspections.map((d, i) => (
                <li key={i}>{d.type} <Pill className={d.result === "passed" ? "bg-ok-soft text-ok" : d.result === "failed" ? "bg-bad-soft text-bad" : "bg-paper-2 text-ink-2"}>{d.result}</Pill></li>
              ))}
            </ul>
          </Section>
        )}
        {x.safety.length > 0 && (
          <Section icon={ShieldPlus} title="Safety">
            <ul className="space-y-1 text-[13.5px] text-ink-2">
              {x.safety.map((s, i) => (
                <li key={i}><Pill className={s.kind === "incident" ? "bg-bad-soft text-bad" : "bg-paper-2 text-ink-2"}>{s.kind.replace("_", " ")}</Pill> <span className="ml-1">{s.description}</span></li>
              ))}
            </ul>
          </Section>
        )}
        {x.manpower.length + x.equipment.length + x.work.length + x.deliveries.length + x.inspections.length + x.safety.length === 0 && (
          <p className="text-[14px] text-mute sm:col-span-2">Nothing structured yet — mention crews, equipment, work areas, deliveries or inspections.</p>
        )}
      </div>
    </div>
  );
}
