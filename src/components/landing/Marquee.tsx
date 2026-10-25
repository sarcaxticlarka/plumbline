"use client";
import { PlumbMark } from "@/components/ui";

const WORDS = ["Notice clocks", "Evidence score", "Hash-chained log", "Weather corroboration", "Claim packet", "Voice first"];

function Row({ reverse }: { reverse?: boolean }) {
  const items = [...WORDS, ...WORDS];
  return (
    <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap py-3 pr-10" style={{ animationDirection: reverse ? "reverse" : "normal" }}>
      {[0, 1].flatMap((k) =>
        items.map((w, i) => (
          <span key={`${k}-${i}`} className="flex items-center gap-10">
            <span className="cond text-[clamp(28px,4vw,56px)]">{w}</span>
            <PlumbMark size={26} className="shrink-0 text-black" />
          </span>
        )),
      )}
    </div>
  );
}

/** Two crossing strips of tape — the loudest thing on the page, deliberately. */
export function Tape() {
  return (
    <div className="relative z-20 -my-10 h-[190px] overflow-hidden md:-my-14 md:h-[260px]">
      <div className="absolute inset-x-[-5%] top-[34%] -rotate-[2.2deg] bg-bone text-black"><Row reverse /></div>
      <div className="absolute inset-x-[-5%] top-[34%] rotate-[1.4deg] bg-safety text-black shadow-[0_0_0_1px_rgba(0,0,0,.4)]"><Row /></div>
    </div>
  );
}
