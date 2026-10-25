"use client";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useMotionValue, animate } from "motion/react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn, scoreStroke, scoreTone } from "@/lib/format";

/* ---------- Logo ---------- */
export function PlumbMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 0v12" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11 6.5 16.5 12 24l5.5-7.5L12 11Z" fill="var(--color-safety)" />
    </svg>
  );
}
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <PlumbMark />
      <span className="wide text-[15px] uppercase tracking-[0.01em]">Plumbline</span>
    </Link>
  );
}

/* ---------- Buttons: mono caps, hard edges, text rolls on hover ---------- */
type Variant = "primary" | "ghost" | "safety" | "dark";
type Size = "sm" | "md" | "lg";
type BtnProps = { variant?: Variant; size?: Size } & ComponentProps<"button">;

const base =
  "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden font-mono uppercase tracking-[0.05em] transition-colors duration-200 active:scale-[.985] disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-white",
  safety: "bg-safety text-on-safety hover:bg-white",
  ghost: "border border-line bg-transparent text-ink hover:border-ink",
  dark: "bg-[#0a0a09] text-bone hover:bg-black",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[11px] rounded-[2px]",
  md: "h-10 px-5 text-[12px] rounded-[2px]",
  lg: "h-[54px] px-7 text-[13px] rounded-[2px]",
};
export const btnClass = (v: Variant = "primary", s: Size = "md", extra?: string) => cn(base, variants[v], sizes[s], extra);

/** Two stacked copies of the label: the visible one slides out, the twin slides in. */
export function Roll({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <span className="inline-flex items-center gap-2.5 transition-transform duration-[450ms] ease-[cubic-bezier(.7,0,.2,1)] group-hover:-translate-y-[110%]">{children}</span>
      <span className="absolute inset-0 inline-flex translate-y-[110%] items-center gap-2.5 transition-transform duration-[450ms] ease-[cubic-bezier(.7,0,.2,1)] group-hover:translate-y-0" aria-hidden>
        {children}
      </span>
    </span>
  );
}

export function Button({ variant = "primary", size = "md", className, children, ...p }: BtnProps) {
  return (
    <button className={btnClass(variant, size, className)} {...p}>
      <Roll>{children}</Roll>
    </button>
  );
}
export function LinkButton({
  href, variant = "primary", size = "md", className, children, ...p
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={btnClass(variant, size, className)} {...p}>
      <Roll>{children}</Roll>
    </Link>
  );
}

/* ---------- Scroll reveal ---------- */
export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Headline that slides up line-by-line out of a mask. */
export function Lines({ lines, className, delay = 0, inView = true }: { lines: ReactNode[]; className?: string; delay?: number; inView?: boolean }) {
  return (
    <span className={cn("block", className)}>
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em] pt-[0.02em]">
          <motion.span
            className="block"
            initial={{ y: "108%" }}
            {...(inView ? { whileInView: { y: 0 }, viewport: { once: true, margin: "-60px" } } : { animate: { y: 0 } })}
            transition={{ duration: 1.1, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ---------- Animated number ---------- */
export function CountUp({ value, duration = 1.2, className, suffix = "" }: { value: number; duration?: number; className?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const [txt, setTxt] = useState("0");
  useEffect(() => mv.on("change", (v) => setTxt(String(Math.round(v)))), [mv]);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, value, duration, mv]);
  return (
    <span ref={ref} className={cn("tnum", className)}>
      {txt}
      {suffix}
    </span>
  );
}

/* ---------- Evidence ring ---------- */
export function ScoreRing({ score, size = 72, stroke = 6, label, className }: { score: number; size?: number; stroke?: number; label?: boolean; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(128,126,118,.22)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100), stroke: scoreStroke(score) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className={cn("display tnum", scoreTone(score))} style={{ fontSize: size * 0.34 }}>{score}</div>
          {label && <div className="label mt-0.5 !text-[8px]">score</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Chips ---------- */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[2px] px-2 py-[5px] font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.05em]", className)}>
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("label flex items-center gap-2.5", className)}>
      <span className="h-[7px] w-[7px] bg-safety" />
      {children}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn("surface relative my-8 w-full", wide ? "max-w-3xl" : "max-w-xl")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="label !text-ink">{title}</div>
              <button onClick={onClose} aria-label="Close" className="font-mono text-[12px] uppercase tracking-[0.06em] text-mute hover:text-ink">Esc ✕</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
