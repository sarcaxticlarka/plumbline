"use client";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { LinkButton, Lines, Logo } from "@/components/ui";
import { PlumbCurtain } from "./PlumbCurtain";

/* Nav slides away on the way down, returns on the way up. */
export function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 160);
    setSolid(y > 40);
  });
  return (
    <motion.header
      animate={{ y: hidden ? "-110%" : 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid ? "border-b border-line bg-paper/75 backdrop-blur-xl" : ""}`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-5 md:px-10">
        <Logo />
        <nav className="hidden items-center gap-9 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-2 md:flex">
          {[["Problem", "#problem"], ["Process", "#process"], ["Ledger", "#ledger"], ["Engine", "#engine"], ["Flow", "#flow"]].map(([l, h], i) => (
            <a key={l} href={h} className="group relative flex items-center gap-2 transition-colors hover:text-ink">
              <span className="text-mute">0{i + 1}</span>
              {l}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-safety transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>
        <LinkButton href="/app" variant="safety" size="sm">
          Open demo <ArrowUpRight className="h-3.5 w-3.5" />
        </LinkButton>
      </div>
    </motion.header>
  );
}

export function Hero() {
  const [delay, setDelay] = useState(0.15);
  useEffect(() => {
    try { if (sessionStorage.getItem("plumbline.intro") !== "1") setDelay(1.95); } catch { /* ignore */ }
  }, []);

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      <div className="drawing absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <PlumbCurtain className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-paper via-paper/85 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-8 md:px-10 md:pb-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.2, duration: 1 }} className="label mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 !text-ink-2 md:mb-7">
          <span className="flex items-center gap-2"><span className="h-[7px] w-[7px] bg-safety" /> Voice → Evidence</span>
          <span className="hidden sm:inline">For site superintendents</span>
          <a href="https://ref.wisprflow.ai/hhg" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-safety hover:underline"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safety" /> Works with Wispr Flow ↗</a>
        </motion.div>

        <h1 className="cond" style={{ fontSize: "clamp(44px, min(11.8vw, 188px), 300px)" }}>
          <Lines lines={["Say what happened.", <span key="b" className="text-safety">Prove it later.</span>]} inView={false} delay={delay} />
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.55, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 grid items-end gap-8 border-t border-line pt-6 md:mt-10 md:grid-cols-[1.1fr_auto_1fr]"
        >
          <p className="max-w-[420px] text-[15px] leading-relaxed text-ink-2">
            Dictate your day on site. Plumbline structures it, starts the notice clocks your contract demands, checks weather claims against
            measured data and seals the entry in a tamper-evident chain.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/app" variant="safety" size="lg">Open live demo <ArrowUpRight className="h-4 w-4" /></LinkButton>
            <LinkButton href="#problem" variant="ghost" size="lg">Why it matters <ArrowDownRight className="h-4 w-4" /></LinkButton>
          </div>
          <div className="hidden justify-self-end font-mono text-[11px] uppercase leading-[1.9] tracking-[0.06em] text-ink-2 md:block">
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safety" /> Chain verified</div>
            <div className="text-mute">10 sealed entries</div>
            <div className="text-mute">22 delay hours on record</div>
            <Link href="/app" className="block text-ink underline-offset-4 hover:underline">Harbor Point Tower ↗</Link>
            <Link href="/app/settings" className="block text-safety underline-offset-4 hover:underline">Bring your own API key ↗</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
