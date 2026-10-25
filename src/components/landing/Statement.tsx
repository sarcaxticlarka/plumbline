"use client";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Reveal, SectionLabel } from "@/components/ui";

/** Words light up one by one as the paragraph scrolls through the viewport. `*…*` marks the emphasised run. */
const TEXT =
  "A delay claim is only as strong as *the sentence you wrote that day.* Most get written at 7 p.m., from memory — or rebuilt weeks later, in a dispute. *Plumbline writes them while you’re still standing in it.*";

function tokenize(t: string) {
  const out: { w: string; mark: boolean }[] = [];
  let mark = false;
  for (const part of t.split("*")) {
    for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w, mark });
    mark = !mark;
  }
  return out;
}
const WORDS = tokenize(TEXT);

function Word({ w, mark, i, p }: { w: string; mark: boolean; i: number; p: MotionValue<number> }) {
  const n = WORDS.length;
  const o = useTransform(p, [i / n, Math.min(1, (i + 4) / n)], [0.13, 1]);
  return (
    <motion.span style={{ opacity: o }} className={mark ? "inline-block bg-ink pl-[0.1em] pr-[0.32em] text-paper" : "mr-[0.22em] inline-block"}>
      {w}
    </motion.span>
  );
}

const PROOFS = [
  { k: "Written that day", t: "Adjudicators generally give more weight to records made at the time than to a timeline rebuilt from memory.", s: "Shape Construction", h: "https://www.shape.construction/templates/daily-report" },
  { k: "Often rejected", t: "Time-and-disruption claims submitted without evidence of what caused the delay are commonly thrown out.", s: "HKA", h: "https://www.hka.com/article/project-records-from-a-delay-analysis-perspective/" },
  { k: "You defend the record", t: "With thin documentation the argument shifts from the delay itself to whether your project records are adequate at all.", s: "American Bar Association", h: "https://www.americanbar.org/groups/litigation/resources/newsletters/insurance-coverage/when-the-schedule-isnt-evidence-builders-delay-claims/" },
  { k: "30–60 min / day", t: "One vendor’s estimate of what a busy site’s daily log costs the person writing it — so it gets written late and short.", s: "ImageToTable (vendor estimate)", h: "https://imagetotable.ai/blog/manual-site-report-data-entry-cost-construction" },
];

export function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.5"] });
  return (
    <section id="problem" className="theme-paper relative scroll-mt-10 py-28 md:py-44">
      <div className="mx-auto max-w-[1600px] px-5 md:px-10">
        <Reveal><SectionLabel>01 — The problem</SectionLabel></Reveal>
        <div ref={ref} className="display mt-10 max-w-[1280px] text-[clamp(34px,6.1vw,104px)] !font-bold leading-[1.02] tracking-[-0.04em]">
          {WORDS.map((w, i) => (
            <Word key={i} {...w} i={i} p={scrollYProgress} />
          ))}
        </div>

        <div className="mt-24 grid border-t border-ink md:mt-36 md:grid-cols-2 xl:grid-cols-4">
          {PROOFS.map((p, i) => (
            <Reveal key={p.k} delay={i * 0.07} className="border-b border-line py-8 md:border-b-0 md:py-10 xl:border-r xl:px-8 xl:first:pl-0 xl:last:border-r-0">
              <div className="label !text-ink-2">0{i + 1}</div>
              <div className="display mt-10 text-[34px] leading-[0.98] md:text-[40px]">{p.k}</div>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">{p.t}</p>
              <a href={p.h} target="_blank" rel="noreferrer" className="label mt-5 inline-block !text-ink underline underline-offset-4 hover:!text-mute">{p.s} ↗</a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
