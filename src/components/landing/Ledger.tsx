"use client";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { chainHashes } from "./hashlib";

const ENTRIES = [
  { d: "OCT 12", t: "Rain from first light. Pour prep and crane stood down. 5 h lost." },
  { d: "OCT 13", t: "12 ironworkers, 9 carpenters. Rebar tied on level 4. No incidents." },
  { d: "OCT 14", t: "Metro Ready Mix delivered level 3 columns on time. Toolbox talk: crane signals." },
  { d: "OCT 15", t: "Architect hasn’t answered RFI 42. Transfer beam on hold. 6 h lost." },
  { d: "OCT 16", t: "Crane shut down for wind gusts. Lost 6 hours of steel and rebar hoisting." },
  { d: "OCT 19", t: "Owner’s rep asked for two extra lobby outlets. Not in contract." },
  { d: "OCT 20", t: "Drywall truck didn’t show until 3 p.m. Crew stood around. 5 h lost." },
  { d: "OCT 21", t: "Unmarked duct bank hit in the elevator pit. Excavation stopped." },
  { d: "OCT 22", t: "Slab poured, 180 yards. City inspector walked it. No issues." },
];
const EDIT_AT = 4; // the tampered entry
const EDITED = "Crane shut down for wind gusts. Lost 2 hours of steel and rebar hoisting.";

export function Ledger() {
  const ref = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [max, setMax] = useState(0);
  const [p, setP] = useState(0);
  const [sealed, setSealed] = useState<string[]>([]);
  const [tampered, setTampered] = useState<string[]>([]);

  useMotionValueEvent(scrollYProgress, "change", setP);
  useEffect(() => {
    chainHashes(ENTRIES.map((e) => e.t)).then(setSealed);
    chainHashes(ENTRIES.map((e, i) => (i === EDIT_AT ? EDITED : e.t))).then(setTampered);
  }, []);
  useEffect(() => {
    const measure = () => row.current && setMax(Math.max(0, row.current.scrollWidth - window.innerWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Travel for the first 78% of the scroll, then hold while the edit lands.
  const x = useTransform(scrollYProgress, [0, 0.78], [0, -max], { clamp: true });
  const edited = p > 0.5;
  const live = edited ? tampered : sealed;
  const firstBad = edited && tampered.length ? EDIT_AT : -1;

  return (
    <section id="ledger" ref={ref} className="relative h-[380vh] scroll-mt-0 border-y border-line">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="drawing absolute inset-0 opacity-40" />
        <div className="relative z-10 mx-auto mb-10 flex w-full max-w-[1600px] flex-wrap items-end justify-between gap-6 px-5 md:mb-14 md:px-10">
          <div>
            <div className="label flex items-center gap-2.5"><span className="h-[7px] w-[7px] bg-safety" /> 03 — The ledger</div>
            <h2 className="cond mt-5 text-[clamp(48px,9vw,150px)]">One edit.<br /><span className="text-safety">Every seal after it fails.</span></h2>
          </div>
          <motion.div
            animate={{ borderColor: firstBad >= 0 ? "#ff6247" : "#52e08f", color: firstBad >= 0 ? "#ff6247" : "#52e08f" }}
            className="border px-4 py-3 font-mono text-[12px] uppercase tracking-[0.08em]"
          >
            {firstBad >= 0 ? `✕ Chain broken at #${firstBad + 1}` : "✓ Chain intact — 9 entries"}
          </motion.div>
        </div>

        <motion.div ref={row} style={{ x }} className="relative z-10 flex w-max items-stretch gap-0 pl-5 pr-[20vw] md:pl-10">
          {ENTRIES.map((e, i) => {
            const bad = firstBad >= 0 && i >= firstBad;
            const isEdit = i === EDIT_AT && edited;
            return (
              <div key={i} className="flex items-center">
                <div className={cn("flex h-[300px] w-[min(82vw,370px)] flex-col justify-between border p-5 transition-colors duration-500", bad ? "border-bad bg-bad-soft" : "border-line bg-card")}>
                  <div className="flex items-center justify-between">
                    <span className="label !text-ink-2">#{String(i + 1).padStart(2, "0")} · {e.d}</span>
                    <span className={cn("font-mono text-[10px] uppercase tracking-[0.08em]", bad ? "text-bad" : "text-ok")}>{bad ? "✕ mismatch" : "✓ match"}</span>
                  </div>
                  <p className={cn("text-[19px] leading-snug", isEdit ? "text-bad" : "text-ink")}>{isEdit ? EDITED : e.t}</p>
                  <div className="space-y-1.5 border-t border-dashed border-line pt-3">
                    <div className="hash flex justify-between text-mute"><span>SEAL</span><span>{(sealed[i] ?? "…").slice(0, 18)}</span></div>
                    <div className={cn("hash flex justify-between", bad ? "text-bad" : "text-ink-2")}><span>NOW</span><span>{(live[i] ?? "…").slice(0, 18)}</span></div>
                  </div>
                </div>
                {i < ENTRIES.length - 1 && (
                  <div className="relative h-px w-14 md:w-20">
                    <div className={cn("absolute inset-0 transition-colors duration-500", firstBad >= 0 && i + 1 > firstBad ? "bg-bad" : "bg-ink/40")} />
                    <div className={cn("absolute -right-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 transition-colors duration-500", firstBad >= 0 && i + 1 > firstBad ? "bg-bad" : "bg-ink/60")} />
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>

        <div className="relative z-10 mx-auto mt-10 w-full max-w-[1600px] px-5 md:px-10">
          <div className="h-px w-full bg-line"><div className="h-px bg-safety" style={{ width: `${Math.min(100, p * 100)}%` }} /></div>
          <p className="mt-3 max-w-xl text-[13px] text-mute">Scroll. At the midpoint someone “fixes” entry #5 — six hours becomes two. Real SHA-256, recomputed live in your browser.</p>
        </div>
      </div>
    </section>
  );
}
