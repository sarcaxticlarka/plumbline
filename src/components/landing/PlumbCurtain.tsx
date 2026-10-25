"use client";
import { useEffect, useRef } from "react";

/**
 * Hundreds of hairline plumb lines hang from the top edge. A slow travelling wave runs through them (the "voice"),
 * and each bob leans toward the pointer like a weight pulled by a magnet. Pure canvas, ~110 strokes per frame.
 */
interface Line { x: number; len: number; phase: number; theta: number; vel: number; lime: boolean }

export function PlumbCurtain({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, visible = true;
    let lines: Line[] = [];
    const pointer = { x: -9999 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = c.getBoundingClientRect();
      W = r.width; H = r.height;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor(W / (W < 700 ? 15 : 12));
      lines = Array.from({ length: n }, (_, i) => {
        const rnd = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
        return { x: (i + 0.5) * (W / n), len: H * (0.18 + 0.74 * Math.pow(rnd, 1.7)), phase: rnd * 6.283, theta: 0, vel: 0, lime: i % 13 === 4 };
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(239,236,227,0.16)";
      ctx.beginPath();
      const tips: [number, number, boolean][] = [];
      for (const L of lines) {
        const wave = Math.sin(L.x * 0.0055 - t * 0.85) * Math.sin(L.x * 0.0019 + t * 0.37);
        let target = Math.sin(t * 0.5 + L.phase) * 0.014 + wave * 0.075;
        const dx = pointer.x - L.x;
        target += Math.atan2(dx, Math.max(L.len, 1)) * Math.exp(-(dx * dx) / (2 * 200 * 200)) * 0.95;
        L.vel = (L.vel + (target - L.theta) * 0.05) * 0.9;
        L.theta += L.vel;
        const x2 = L.x + Math.sin(L.theta) * L.len;
        const y2 = Math.cos(L.theta) * L.len;
        if (!L.lime) { ctx.moveTo(L.x, 0); ctx.lineTo(x2, y2); }
        tips.push([x2, y2, L.lime]);
      }
      ctx.stroke();
      // lime lines + bobs
      ctx.strokeStyle = "rgba(210,255,30,0.85)";
      ctx.fillStyle = "rgba(239,236,227,0.55)";
      lines.forEach((L, i) => {
        const [x2, y2, lime] = tips[i];
        if (lime) {
          ctx.beginPath(); ctx.moveTo(L.x, 0); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.save(); ctx.translate(x2, y2); ctx.rotate(-L.theta); ctx.fillStyle = "#d2ff1e";
          ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(4.2, 4); ctx.lineTo(0, 13); ctx.lineTo(-4.2, 4); ctx.closePath(); ctx.fill(); ctx.restore();
          ctx.fillStyle = "rgba(239,236,227,0.55)";
        } else {
          ctx.beginPath(); ctx.arc(x2, y2, 1.5, 0, 6.283); ctx.fill();
        }
      });
    };

    const loop = (ts: number) => {
      if (visible) draw(ts / 1000);
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => { pointer.x = e.clientX - c.getBoundingClientRect().left; };
    const leave = () => { pointer.x = -9999; };

    resize();
    window.addEventListener("resize", resize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(c);
    if (reduce) draw(2);
    else {
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerleave", leave);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
