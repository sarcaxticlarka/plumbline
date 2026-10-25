"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { LinkButton, Reveal, ScoreRing, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/format";

const FLOW_LINK = "https://ref.wisprflow.ai/hhg";

/* ---------------------------------------------------------------- */
/* Looping demo: hold hotkey → burst of text → question → answer → seal */
/* ---------------------------------------------------------------- */
const BURST1 = "The tower crane was shut down for wind gusts. Lost about four hours of steel hoisting. The architect still hasn't answered RFI 42.";
const BURST2 = "We lost about six hours on the RFI. Ironworkers couldn't set the transfer beam.";

function useStep() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 6 : 0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduce) return;
    setStep(0);
    const T = [900, 2300, 4200, 5600, 7400, 9000, 12200];
    const ids = T.map((t, i) => setTimeout(() => setStep(i + 1), t));
    const loop = setTimeout(() => setCycle((c) => c + 1), 13600);
    return () => { ids.forEach(clearTimeout); clearTimeout(loop); };
  }, [reduce, cycle]);
  return step;
}

function FlowMock() {
  const step = useStep();
  const listening = step === 1 || step === 4;
  const heard1 = step >= 2;
  const asking = step >= 3 && step < 6;
  const heard2 = step >= 5;
  const sealed = step >= 6;
  const score = sealed ? 91 : heard2 ? 84 : asking ? 62 : heard1 ? 62 : 0;

  const bar = sealed ? "Sealed as entry #16 ✓" : step === 5 ? "Flow heard 14 words ✓" : step === 4 ? "Listening…" : asking ? "Answer: how many hours were lost on the RFI delay?" : heard1 ? "Flow heard 24 words ✓" : step === 1 ? "Listening…" : "Flow ready — hold your hotkey and speak";
  const active = listening || step === 2 || step === 5 || asking;

  return (
    <div className="relative border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="label">Entry · Harbor Point · Level 4</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-safety">{heard1 ? `${heard2 ? 38 : 24} words spoken` : "voice entry"}</span>
      </div>
      <div className="min-h-[330px] p-5 md:p-7">
        <div className="flex items-start justify-between gap-6">
          <div className="min-h-[190px] flex-1 text-[17px] leading-[1.65] text-ink">
            <AnimatePresence>
              {heard1 && <motion.span initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.45 }}>{BURST1} </motion.span>}
              {heard2 && <motion.span key="b2" initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.45 }} className="text-safety">{BURST2}</motion.span>}
            </AnimatePresence>
            {!heard1 && <span className="text-mute">Click here. Hold your hotkey. Talk.</span>}
          </div>
          <AnimatePresence>{score > 0 && <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><ScoreRing score={score} size={84} stroke={7} label /></motion.div>}</AnimatePresence>
        </div>

        <AnimatePresence>
          {asking && !heard2 && (
            <motion.div key="ask" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4 border border-safety bg-safety-soft p-4">
              <div className="label !text-safety">Plumbline asks</div>
              <div className="mt-1.5 text-[16px] font-medium">How many hours were lost on the RFI delay?</div>
            </motion.div>
          )}
          {sealed && (
            <motion.div key="seal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3 border border-ok/50 bg-ok-soft p-4 text-ok">
              <Check className="h-5 w-5" strokeWidth={3} /> <span className="text-[15px] font-medium">Sealed · notice clock started · chained to #15</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the Flow-style bar */}
      <div className="flex justify-center border-t border-line bg-paper/60 p-4">
        <div className={cn("flex w-full max-w-[520px] items-center gap-4 rounded-full border bg-paper py-2 pl-2.5 pr-5 transition-colors", active ? "border-safety" : "border-line")}>
          <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-full", active ? "bg-safety text-on-safety" : "bg-ink/10")}>
            {active && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-safety" />}
            <span className="relative flex h-4 items-center gap-[2px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.i key={i} className="block w-[2.5px] rounded-full bg-current" animate={{ height: active ? [4, 14, 6, 12, 4] : 4 }} transition={{ duration: 0.8 + i * 0.1, repeat: Infinity }} />
              ))}
            </span>
          </span>
          <span className="truncate text-[13.5px] text-ink-2">{bar}</span>
        </div>
      </div>
    </div>
  );
}

export function FlowSection() {
  return (
    <section id="flow" className="relative scroll-mt-10 overflow-hidden border-y border-line py-24 md:py-40">
      <div className="drawing absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-[1600px] px-5 md:px-10">
        <Reveal><SectionLabel>06 — Built for Wispr Flow</SectionLabel></Reveal>
        <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Reveal><h2 className="cond text-[clamp(64px,10.5vw,176px)]">Hold.<br />Speak.<br /><span className="text-safety">Sealed.</span></h2></Reveal>
            <Reveal delay={0.1}>
              <p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
                Superintendents don’t have hands free. <b className="text-ink">Wispr Flow</b> types into any text field — so Plumbline needs nothing special. Click the entry box, hold your hotkey, talk. Flow cleans the filler and punctuates; Plumbline structures it, finds the claim, and asks the next question.
              </p>
              <ul className="mt-8 divide-y divide-line border-y border-line">
                {[
                  ["Dictation detected", "Words that arrive in a burst are counted as voice — with the typing time you saved."],
                  ["Guide me by voice", "Plumbline asks for each missing detail; you answer with the same hotkey. Hands-free, in order."],
                  ["Built-in mic too", "No Flow? Chrome’s mic works, with “scratch that”, “next question”, “seal entry”."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-5 py-4"><span className="font-mono text-[12px] text-safety">0{i + 1}</span><div><div className="font-semibold">{t}</div><div className="text-[14px] text-mute">{d}</div></div></li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={FLOW_LINK} target="_blank" rel="noreferrer" className="group inline-flex h-[54px] items-center gap-2.5 bg-safety px-7 font-mono text-[13px] uppercase tracking-[0.05em] text-on-safety transition-colors hover:bg-white">Get Wispr Flow <ArrowUpRight className="h-4 w-4" /></a>
                <LinkButton href="/app" variant="ghost" size="lg">Try it in the demo</LinkButton>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15}><FlowMock /></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* No code: paste a key, test it, go                                  */
/* ---------------------------------------------------------------- */
const PROVIDERS = ["Claude", "OpenAI", "OpenRouter", "Groq", "Together", "Ollama"];
const KEY = "sk-ant-api03-••••••••••••••••••••";

export function ByokSection() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? KEY.length : 0);
  const [done, setDone] = useState(Boolean(reduce));
  const [p, setP] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      i = 0; setN(0); setDone(false);
      const tick = () => {
        i += 1; setN(i);
        if (i < KEY.length) t = setTimeout(tick, 55);
        else t = setTimeout(() => { setDone(true); t = setTimeout(run, 4200); }, 600);
      };
      t = setTimeout(tick, 900);
    };
    run();
    return () => clearTimeout(t);
  }, [reduce]);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setP((x) => (x + 1) % PROVIDERS.length), 1400);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <section className="relative py-24 md:py-36">
      <div className="mx-auto max-w-[1600px] px-5 md:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <div className="border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line px-5 py-3"><span className="label">Settings · Bring your own key</span><span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-safety" /></span></div>
              <div className="space-y-5 p-6 md:p-8">
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDERS.map((x, i) => (
                    <span key={x} className={cn("border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors duration-500", i === p ? "border-safety text-safety" : "border-line text-mute")}>{x}</span>
                  ))}
                </div>
                <div>
                  <div className="label">API key</div>
                  <div className="mt-1.5 flex h-12 items-center border border-line bg-field px-4 font-mono text-[14px]">{KEY.slice(0, n)}<span className="ml-0.5 h-5 w-[2px] animate-blink bg-safety" /></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 items-center bg-ink px-5 font-mono text-[12px] uppercase tracking-[0.05em] text-paper">Test connection</span>
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.span key="ok" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-[13px] text-ok"><Check className="h-4 w-4" strokeWidth={3} /> Connected · claude-opus-5-5 · 842 ms</motion.span>
                    ) : (
                      <motion.span key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-mute">{n >= KEY.length ? "Calling the API…" : "Paste a key…"}</motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="border-t border-line pt-4 text-[12.5px] leading-relaxed text-mute">Stays in this browser. Sent only as a header on each request; never stored or logged.</p>
              </div>
            </div>
          </Reveal>
          <div>
            <Reveal><SectionLabel>07 — No code required</SectionLabel></Reveal>
            <Reveal delay={0.05}><h2 className="cond mt-8 text-[clamp(56px,8.5vw,140px)]">Bring<br />your <span className="text-safety">key.</span></h2></Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-[500px] text-[16.5px] leading-relaxed text-ink-2">
                Open the live site, paste an Anthropic key — or any OpenAI-compatible API: OpenAI, OpenRouter, Groq, Together — and test it in one click. No environment variables, no deploy. Prefer no cloud at all? The offline engine needs nothing.
              </p>
              <div className="mt-7"><LinkButton href="/app/settings" variant="ghost" size="lg">Open settings <ArrowUpRight className="h-4 w-4" /></LinkButton></div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
