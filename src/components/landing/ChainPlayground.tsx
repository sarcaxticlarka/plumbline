"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/format";
import { chainHashes } from "./hashlib";

const SEED = [
  { date: "Oct 14", text: "Crew of 12 ironworkers on level 4. No delays." },
  { date: "Oct 15", text: "Crane shut down for wind gusts. Lost 6 hours of hoisting." },
  { date: "Oct 16", text: "Architect has not answered RFI 42. Transfer beam on hold." },
  { date: "Oct 17", text: "Unmarked duct bank hit in the elevator pit. Excavation stopped." },
  { date: "Oct 18", text: "Slab poured, 180 yards. Inspector walked it, no issues." },
];

export function ChainPlayground() {
  const [texts, setTexts] = useState(SEED.map((s) => s.text));
  const [sealed, setSealed] = useState<string[]>([]);
  const [live, setLive] = useState<string[]>([]);

  useEffect(() => {
    chainHashes(SEED.map((s) => s.text)).then((h) => { setSealed(h); setLive(h); });
  }, []);
  useEffect(() => {
    let off = false;
    chainHashes(texts).then((h) => !off && setLive(h));
    return () => { off = true; };
  }, [texts]);

  const firstBad = live.length && sealed.length ? live.findIndex((h, i) => h !== sealed[i]) : -1;
  const intact = firstBad === -1;

  return (
    <section className="theme-paper relative py-24 md:py-40">
      <div className="mx-auto max-w-[1600px] px-5 md:px-10">
        <SectionLabel>04 — Your turn</SectionLabel>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <h2 className="cond text-[clamp(56px,11vw,190px)]">Break it.</h2>
          <p className="max-w-md pb-3 text-[16px] leading-relaxed text-ink-2">
            These five entries are editable. Change “6 hours” to “2 hours” in entry #2 and watch the seals — each one includes the hash of the entry before it.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-y border-ink py-4">
          <AnimatePresence mode="wait">
            <motion.div key={intact ? "ok" : "bad"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={cn("font-mono text-[12px] uppercase tracking-[0.08em]", intact ? "text-ok" : "text-bad")}>
              {intact ? "✓ Chain intact — every entry matches its seal" : `✕ Chain broken at entry #${firstBad + 1} — everything after it fails too`}
            </motion.div>
          </AnimatePresence>
          <Button variant="dark" size="sm" onClick={() => setTexts(SEED.map((s) => s.text))} disabled={intact}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
        </div>

        <div className="grid md:grid-cols-5">
          {SEED.map((s, i) => {
            const bad = firstBad !== -1 && i >= firstBad;
            return (
              <motion.div
                key={i}
                animate={bad ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className={cn("flex flex-col border-b border-ink p-5 transition-colors duration-300 md:border-b-0 md:border-r md:last:border-r-0", bad ? "bg-bad-soft" : "")}
              >
                <div className="flex items-center justify-between"><span className="label !text-ink">#{i + 1} · {s.date}</span><span className={cn("font-mono text-[10px]", bad ? "text-bad" : "text-ok")}>{bad ? "✕" : "✓"}</span></div>
                <textarea
                  value={texts[i]}
                  onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                  rows={5}
                  aria-label={`Entry ${i + 1}`}
                  className={cn("mt-4 w-full flex-1 resize-none bg-transparent text-[16px] leading-snug outline-none focus:bg-ink/5", texts[i] !== s.text && "text-bad")}
                />
                <div className="mt-4 border-t border-dashed border-line pt-3">
                  <div className="label !text-[9px]">seal</div>
                  <div className={cn("hash mt-1 truncate", bad ? "text-bad" : "text-ink-2")}>{(live[i] ?? "…").slice(0, 18)}</div>
                  {bad && <div className="hash mt-1 truncate text-mute line-through">{(sealed[i] ?? "").slice(0, 18)}</div>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
