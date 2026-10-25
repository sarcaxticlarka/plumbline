"use client";
import Lenis from "lenis";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/* ---------------- smooth scroll ---------------- */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, anchors: true });
    let id = 0;
    const raf = (t: number) => {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [reduce]);
  return null;
}

/* ---------------- cursor: a lime dot that swells over anything clickable ---------------- */
export function Cursor() {
  const [on, setOn] = useState(false);
  const [big, setBig] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 520, damping: 38, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 520, damping: 38, mass: 0.4 });

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setOn(true);
    document.documentElement.classList.add("has-cursor");
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement | null;
      setBig(Boolean(t?.closest("a,button,[role=button],label,input,textarea,[data-cursor]")));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [x, y]);

  if (!on) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[300] rounded-full bg-white mix-blend-difference"
      style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
      animate={{ width: big ? 58 : 12, height: big ? 58 : 12 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    />
  );
}

/* ---------------- preloader: a plumb line drops while the counter climbs ---------------- */
export function Preloader() {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("plumbline.intro") === "1"; } catch { /* private mode */ }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
    document.documentElement.style.overflow = "hidden";
    const start = performance.now();
    const dur = 1500;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(100 * (1 - Math.pow(1 - p, 2.2))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else
        setTimeout(() => {
          setShow(false);
          document.documentElement.style.overflow = "";
          try { sessionStorage.setItem("plumbline.intro", "1"); } catch { /* ignore */ }
        }, 260);
    };
    raf = requestAnimationFrame(tick);
    // Safety net: background tabs throttle rAF — never leave the visitor stuck behind the curtain.
    const failsafe = setTimeout(() => {
      setShow(false);
      document.documentElement.style.overflow = "";
    }, 3600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pre"
          className="fixed inset-0 z-[400] bg-night text-ink"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="drawing absolute inset-0 opacity-70" />
          <div className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-ink/60" style={{ height: `${8 + n * 0.62}%` }}>
            <span className="absolute -bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-safety" />
          </div>
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between md:bottom-10 md:left-10 md:right-10">
            <div className="label !text-ink-2">Plumbline — voice-to-evidence</div>
            <div className="cond tnum text-[clamp(90px,22vw,320px)] leading-[0.8] text-ink">
              {String(n).padStart(2, "0")}
              <span className="text-safety">%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LandingProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <Cursor />
      <Preloader />
      {children}
    </>
  );
}
