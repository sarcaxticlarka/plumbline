"use client";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Pill, ScoreRing } from "@/components/ui";
import { cn } from "@/lib/format";

const STEPS = [
  { k: "Dictate", t: "Talk like you would to your foreman.", d: "Wispr Flow, your phone’s dictation or the built-in mic. No forms, no dropdowns, no 7 p.m. write-up." },
  { k: "Structure", t: "Every claim-relevant event, pulled out.", d: "Manpower, equipment, deliveries, inspections, safety — and each delay, change or differing condition with a verbatim quote, or it’s dropped." },
  { k: "Ask", t: "It asks what a lawyer would ask.", d: "Hours lost? Who’s responsible? Which trades? Each gap becomes a question you answer by voice — while the notice clock is already running." },
  { k: "Seal", t: "Weather-checked. Hash-chained.", d: "Measured wind and rain corroborate (or contradict) the claim. The entry is sealed into a chain: change one byte and every later seal fails." },
];

const SCRIPT =
  "The tower crane was shut down at ten thirty because of wind gusts, lost about six hours of steel and rebar hoisting. The architect still hasn't answered RFI 42 on the beam conflict at grid C.";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- visuals, driven by `l` = progress inside the step (0 → 1) ---------- */
function V1({ l }: { l: number }) {
  const n = Math.floor(clamp(l * 1.15) * SCRIPT.length);
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-safety"><span className="h-2 w-2 animate-pulse rounded-full bg-safety" /> Listening</div>
        <div className="flex h-5 items-center gap-[3px]">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="w-[2px] bg-safety/80" style={{ height: Math.round(3 + Math.abs(Math.sin(i * 1.7 + l * 24)) * 16) }} />
          ))}
        </div>
      </div>
      <p className="mt-8 min-h-[190px] text-[clamp(18px,1.9vw,26px)] leading-[1.45] text-ink">
        {SCRIPT.slice(0, n)}
        <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] animate-blink bg-safety" />
      </p>
      <div className="label mt-6 border-t border-line pt-4">Harbor Point · Level 4 · Tue 21 Oct</div>
    </div>
  );
}

function Row({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <motion.div animate={{ opacity: on ? 1 : 0, y: on ? 0 : 14 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div>
  );
}

function V2({ l }: { l: number }) {
  return (
    <div className="space-y-4 p-6 md:p-8">
      <Row on={l > 0.05}>
        <div className="label mb-2">Manpower · 29</div>
        <div className="flex flex-wrap gap-1.5">
          {["12 Ironworkers", "9 Carpenters · Atlas Framing", "8 Laborers"].map((x) => <Pill key={x} className="bg-paper-2 text-ink">{x}</Pill>)}
        </div>
      </Row>
      <Row on={l > 0.25}>
        <div className="border border-line p-4">
          <div className="flex items-center gap-2"><Pill className="bg-safety text-on-safety">Delay</Pill><b className="text-[16px]">Wind — crane stand-down</b></div>
          <div className="mt-2.5 flex flex-wrap gap-1.5"><Pill className="bg-paper-2 text-ink-2">6 h lost</Pill><Pill className="bg-paper-2 text-ink-2">Weather</Pill><Pill className="bg-bad-soft text-bad">Critical path?</Pill></div>
          <p className="mt-3 border-l-2 border-safety pl-3 text-[13.5px] italic text-ink-2">“The tower crane was shut down at ten thirty because of wind gusts…”</p>
        </div>
      </Row>
      <Row on={l > 0.55}>
        <div className="border border-line p-4">
          <div className="flex items-center gap-2"><Pill className="bg-safety text-on-safety">Delay</Pill><b className="text-[16px]">Design / RFI delay</b></div>
          <div className="mt-2.5 flex flex-wrap gap-1.5"><Pill className="bg-paper-2 text-ink-2">Architect</Pill><Pill className="bg-paper-2 text-ink-2">Ironworkers</Pill><Pill className="bg-warn-soft text-warn">Hours not stated</Pill></div>
        </div>
      </Row>
    </div>
  );
}

function Q({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-line py-3 text-[15px] transition-colors duration-500", done ? "text-mute line-through" : "text-ink")}>
      <span className={cn("grid h-5 w-5 place-items-center border", done ? "border-ok bg-ok text-black" : "border-line")}>{done && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
      {children}
    </div>
  );
}

function V3({ l }: { l: number }) {
  const score = Math.round(54 + clamp(l * 1.3) * 34);
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-6">
        <ScoreRing score={score} size={112} stroke={9} label />
        <div className="flex-1 border border-line p-4">
          <div className="label">Notice clock</div>
          <div className="cond mt-1 text-[64px] text-safety">7 days</div>
          <div className="label !text-ink-2">due Oct 28 · on your calendar</div>
        </div>
      </div>
      <div className="label mt-8">Plumbline asks</div>
      <div className="mt-2">
        <Q done={l > 0.3}>How many hours were lost on the RFI delay?</Q>
        <Q done={l > 0.55}>Which trades were stopped?</Q>
        <Q done={l > 0.8}>Photo of the unframed stair area?</Q>
      </div>
    </div>
  );
}

function Block({ n, hash, prev, hot, sealed }: { n: number; hash: string; prev: string; hot?: boolean; sealed: boolean }) {
  return (
    <motion.div
      animate={{ opacity: hot && !sealed ? 0 : 1, x: hot && !sealed ? 40 : 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn("border p-4", hot ? "border-safety" : "border-line")}
    >
      <div className="flex items-center justify-between"><span className="label !text-ink-2">Entry #{n}</span>{hot ? <span className="label !text-safety">sealed ✓</span> : <span className="label">verified</span>}</div>
      <div className="hash mt-3 break-all text-ink">{hash}</div>
      <div className="hash mt-1.5 flex items-center gap-1.5 text-mute"><Link2 className="h-3 w-3" /> {prev}</div>
    </motion.div>
  );
}

function V4({ l }: { l: number }) {
  const sealed = l > 0.45;
  return (
    <div className="space-y-3 p-6 md:p-8">
      <div className="flex gap-2"><Pill className="bg-ok-soft text-ok">Gust 52 km/h — corroborated</Pill><Pill className="bg-paper-2 text-ink-2">2 photos hashed</Pill></div>
      <Block sealed={sealed} n={13} hash="61bd02aa4f1e7c93d5a0b8e2c7714a9f" prev="← 9be41d07…c3a2" />
      <div className="mx-auto h-4 w-px bg-line" />
      <Block sealed={sealed} n={14} hash="e9ac0ae38c4b20d1f7a6559c0e8b9617" prev="← 61bd02aa…77f2" />
      <div className="mx-auto h-4 w-px bg-line" />
      <Block sealed={sealed} n={15} hash="9f3a7c41b0e2d58a6c1f04d97be3c1e0" prev="← e9ac0ae3…9617" hot />
    </div>
  );
}

export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", setP);
  const step = Math.min(3, Math.floor(p * 4));
  const l = clamp(p * 4 - step);
  const S = STEPS[step];
  const V = [V1, V2, V3, V4][step];

  return (
    <section id="process" ref={ref} className="relative h-[420vh] scroll-mt-0">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="drawing absolute inset-0 opacity-50" />
        <AnimatePresence mode="popLayout">
          <motion.div
            key={step}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="cond pointer-events-none absolute -left-[2vw] bottom-[-6vw] text-[clamp(280px,46vw,820px)] leading-[0.75] text-transparent [-webkit-text-stroke:1px_rgba(239,236,227,0.1)]"
          >
            0{step + 1}
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 mx-auto grid w-full max-w-[1600px] items-center gap-8 px-5 md:px-10 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <div>
            <div className="label flex items-center gap-2.5"><span className="h-[7px] w-[7px] bg-safety" /> 02 — The process</div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                <div className="mt-6 flex items-baseline gap-4"><span className="font-mono text-[13px] text-safety">0{step + 1}/04</span><span className="cond text-[clamp(30px,4vw,56px)] text-ink-2">{S.k}</span></div>
                <h2 className="display mt-3 max-w-[16ch] text-[clamp(36px,5.6vw,92px)] !font-bold leading-[0.96] tracking-[-0.04em]">{S.t}</h2>
                <p className="mt-6 max-w-[460px] text-[16px] leading-relaxed text-ink-2">{S.d}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-10 flex gap-2">
              {STEPS.map((_, i) => (
                <div key={i} className="relative h-[3px] w-14 bg-line md:w-20">
                  <div className="absolute inset-y-0 left-0 bg-safety" style={{ width: `${i < step ? 100 : i === step ? l * 100 : 0}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="relative border border-line bg-card/90 backdrop-blur">
            <div className="flex items-center justify-between border-b border-line px-5 py-3"><span className="label">Plumbline · field entry</span><span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-safety" /></span></div>
            <div className="min-h-[360px] md:min-h-[430px]"><V l={l} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
