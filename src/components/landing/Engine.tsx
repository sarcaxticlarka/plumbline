"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowUpRight, Check, Minus } from "lucide-react";
import { LinkButton, Reveal, ScoreRing, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/format";

function Checks() {
  const checks: [string, boolean][] = [["Cause identified", true], ["Impact quantified", true], ["Affected trades named", true], ["Responsible party stated", false], ["Weather record corroborates", true], ["Logged same day", true]];
  return (
    <div className="flex items-center gap-8">
      <ScoreRing score={83} size={132} stroke={10} label />
      <ul className="flex-1 divide-y divide-line border-y border-line">
        {checks.map(([l, ok], i) => (
          <motion.li key={l} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }} className="flex items-center gap-3 py-2.5 text-[14px]">
            <span className={cn("grid h-[18px] w-[18px] place-items-center", ok ? "bg-ok text-black" : "border border-warn text-warn")}>{ok ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <Minus className="h-3 w-3" strokeWidth={3.5} />}</span>
            <span className={ok ? "text-ink-2" : "text-warn"}>{l}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Clock() {
  return (
    <div>
      <div className="flex h-28 items-end justify-between">
        {Array.from({ length: 28 }).map((_, i) => (
          <motion.span key={i} initial={{ height: 0 }} animate={{ height: i % 7 === 0 ? 96 : 52 }} transition={{ delay: i * 0.018, duration: 0.5 }} className={cn("w-px", i < 20 ? "bg-ink/70" : i < 25 ? "bg-safety" : "bg-bad")} />
        ))}
      </div>
      <div className="relative -mt-2 h-[3px] bg-line"><motion.div className="absolute -top-[22px] h-[46px] w-[3px] bg-safety" initial={{ left: "0%" }} animate={{ left: "74%" }} transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }} /></div>
      <div className="mt-6 flex items-end justify-between"><div className="cond text-[88px] text-safety">2 <span className="text-[34px] text-ink-2">days left</span></div><div className="label text-right">Notice due Oct 29<br />7-day window · calendar reminder set</div></div>
    </div>
  );
}

function Weather() {
  const Bar = ({ l, v, w, t, ok }: { l: string; v: string; w: string; t: string; ok: boolean }) => (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.06em]"><span className="text-ink-2">{l}</span><span className={ok ? "text-ok" : "text-warn"}>{v}</span></div>
      <div className="relative h-[10px] bg-line"><motion.div className={cn("h-full", ok ? "bg-safety" : "bg-mute")} initial={{ width: 0 }} animate={{ width: w }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} /><div className="absolute -top-2 h-[26px] w-[2px] bg-ink" style={{ left: t }} /></div>
    </div>
  );
  return (
    <div className="space-y-7">
      <Bar l="Max gust · threshold 40 km/h" v="52 km/h ✓ supports 'wind delay'" w="86%" t="66%" ok />
      <Bar l="Rain · threshold 2.5 mm" v="0.0 mm ✕ would flag 'rain delay'" w="2%" t="33%" ok={false} />
      <p className="border-l-2 border-safety pl-4 text-[14px] leading-relaxed text-ink-2">Measured values from Open-Meteo are sealed inside the entry, so later revisions upstream can’t change your evidence.</p>
    </div>
  );
}

function Packet() {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-8">
      <div className="space-y-2.5">
        {[["Weather", 11, "bg-safety"], ["Design / RFI", 6, "bg-ink"], ["Material delivery", 5, "bg-ink-2"]].map(([l, h, c], i) => (
          <div key={l as string} className="grid grid-cols-[120px_1fr_36px] items-center gap-3 text-[13px]">
            <span className="text-ink-2">{l}</span>
            <span className="h-3 bg-line"><motion.span className={cn("block h-full", c as string)} initial={{ width: 0 }} animate={{ width: `${(h as number) * 8}%` }} transition={{ delay: 0.1 * i, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} /></span>
            <b className="tnum text-right">{h as number} h</b>
          </div>
        ))}
        <div className="label pt-3">Delay hours by cause · printable, with integrity statement</div>
      </div>
      <motion.div initial={{ rotate: -14, scale: 2, opacity: 0 }} animate={{ rotate: -9, scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 14 }} className="grid h-[88px] w-[88px] place-items-center rounded-full border-[3px] border-ok text-center font-mono text-[10px] font-bold uppercase leading-tight tracking-wider text-ok">Chain<br />verified</motion.div>
    </div>
  );
}

const ITEMS = [
  { k: "Evidence score", s: "Asks what a lawyer would ask — out loud, while you’re still on site.", d: "Every event is scored on cause, quantified hours, affected trades, responsible party, contemporaneous wording and corroboration. Every missing piece becomes a question you can answer by voice.", V: Checks },
  { k: "Notice clocks", s: "Miss the window, lose the claim.", d: "Each delay, change or differing condition starts a countdown from your contract’s notice window — with calendar reminders and a drafted, fact-filled notice letter ready to send.", V: Clock },
  { k: "Weather check", s: "Rain claimed. Rain measured?", d: "Weather delays are checked against measured precipitation, gusts and temperature at your site. Weak claims are flagged before anyone else flags them; strong ones carry data.", V: Weather },
  { k: "Claim packet", s: "From daily log to delay chronology in one click.", d: "A printable record: hours lost by cause and party, full chronology with quotes and evidence scores, and a chain-of-integrity statement. CSV and calendar exports included.", V: Packet },
];

export function Engine() {
  const [open, setOpen] = useState(0);
  return (
    <section id="engine" className="relative scroll-mt-10 py-24 md:py-40">
      <div className="mx-auto max-w-[1600px] px-5 md:px-10">
        <Reveal><SectionLabel>05 — The engine</SectionLabel></Reveal>
        <Reveal><h2 className="cond mt-8 max-w-[14ch] text-[clamp(56px,11vw,190px)]">Not a log.<br /><span className="text-safety">A claim engine.</span></h2></Reveal>

        <div className="mt-20 border-t border-ink">
          {ITEMS.map((it, i) => {
            const on = open === i;
            return (
              <div key={it.k} className="border-b border-line">
                <button onClick={() => setOpen(on ? -1 : i)} data-cursor className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-5 py-6 text-left md:gap-10 md:py-9">
                  <span className="font-mono text-[12px] text-mute">0{i + 1}</span>
                  <span className={cn("cond text-[clamp(40px,7.4vw,124px)] transition-all duration-500 group-hover:translate-x-3", on ? "text-safety" : "text-ink")}>{it.k}</span>
                  <span className={cn("grid h-11 w-11 place-items-center border transition-all duration-500", on ? "rotate-45 border-safety bg-safety text-black" : "border-line text-ink group-hover:border-ink")}><ArrowUpRight className="h-5 w-5" /></span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <div className="grid gap-10 pb-12 md:grid-cols-[auto_1fr_1fr] md:gap-16 md:pb-16">
                        <div className="hidden w-[40px] md:block" />
                        <div>
                          <p className="display max-w-[22ch] text-[clamp(24px,2.6vw,40px)] !font-semibold leading-[1.08] tracking-[-0.03em]">{it.s}</p>
                          <p className="mt-5 max-w-[480px] text-[15.5px] leading-relaxed text-ink-2">{it.d}</p>
                        </div>
                        <div className="border border-line bg-card p-6 md:p-8"><it.V /></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- compare --------------------------- */
const ROWS: [string, boolean | "some", boolean | "some", boolean][] = [
  ["Capture by voice", false, "some", true],
  ["Structured fields from free speech", false, "some", true],
  ["Claim events detected automatically", false, false, true],
  ["Contract notice clocks & drafted letters", false, false, true],
  ["Asks for missing evidence while you’re on site", false, false, true],
  ["Weather claims checked against measured data", false, false, true],
  ["Tamper-evident hash chain anyone can verify", false, false, true],
  ["Delay chronology & claim packet export", false, "some", true],
];
const cell = (v: boolean | "some") => (v === true ? <Check className="mx-auto h-[18px] w-[18px]" strokeWidth={3} /> : v === "some" ? <span className="font-mono text-[11px] uppercase text-mute">varies</span> : <span className="text-mute">—</span>);

export function Compare() {
  return (
    <section className="relative border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-[1600px] px-5 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
          <Reveal className="min-w-0">
            <SectionLabel>08 — Where it sits</SectionLabel>
            <h2 className="display mt-8 text-[clamp(34px,4.8vw,76px)] !font-bold leading-[0.98] tracking-[-0.04em]">Daily-report apps record the day. <span className="text-safety">Plumbline defends it.</span></h2>
          </Reveal>
          <Reveal delay={0.1} className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-[14.5px]">
                <thead>
                  <tr className="border-b border-ink text-left"><th className="py-3 font-normal"><span className="label">Capability</span></th><th className="px-3 text-center font-normal"><span className="label">Paper</span></th><th className="px-3 text-center font-normal"><span className="label">Report apps</span></th><th className="bg-safety px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-black">Plumbline</th></tr>
                </thead>
                <tbody>
                  {ROWS.map(([n, a, b, c]) => (
                    <tr key={n} className="border-b border-line"><td className="py-3.5 pr-4">{n}</td><td className="px-3 text-center">{cell(a)}</td><td className="px-3 text-center">{cell(b)}</td><td className="bg-safety-soft px-3 text-center text-safety">{cell(c)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-mute">Category-level summary from public product pages, October 2026; capabilities vary by vendor and plan.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- finale ---------------------------- */
export function Finale() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div className="drawing absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-[1600px] px-5 pb-0 pt-28 md:px-10 md:pt-44">
        <Reveal>
          <h2 className="cond text-[clamp(56px,13.5vw,260px)]">Tomorrow’s claim<br />is being written <span className="text-safety">today.</span></h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-12 flex flex-wrap items-center gap-4">
          <LinkButton href="/app" variant="safety" size="lg">Open the live demo <ArrowUpRight className="h-4 w-4" /></LinkButton>
          <LinkButton href="/app/projects/new" variant="ghost" size="lg">Start a project</LinkButton>
          <span className="label ml-2">Real project · real weather data · live clocks</span>
        </Reveal>

        <div className="mt-28 flex flex-col gap-6 border-t border-line pt-6 text-[12.5px] leading-relaxed text-mute md:flex-row md:justify-between">
          <p className="max-w-xl">Plumbline structures and preserves site records. It is not legal advice. Notice periods and required formats differ by contract and jurisdiction — confirm against your documents or counsel. Sample data in the demo is fictional.</p>
          <div className="flex gap-8 font-mono uppercase tracking-[0.06em]"><a href="#problem" className="hover:text-ink">Problem</a><a href="#process" className="hover:text-ink">Process</a><a href="#ledger" className="hover:text-ink">Ledger</a><a href="/app" className="hover:text-ink">Demo</a></div>
        </div>

        <div className="wide pointer-events-none mt-8 select-none whitespace-nowrap text-center text-[13.3vw] leading-[0.76] tracking-[-0.045em] text-ink" style={{ marginBottom: "-1.6vw" }} aria-hidden>
          PLUMBLINE
        </div>
      </div>
    </section>
  );
}
