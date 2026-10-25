"use client";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/format";

export type FlowState =
  | { kind: "hidden" }
  | { kind: "ready" }
  | { kind: "mic" }
  | { kind: "heard"; text: string }
  | { kind: "ask"; text: string };

/**
 * A floating "Flow bar" in the spirit of Wispr Flow's own: always tells you what to do next with your voice.
 * It doesn't talk to Wispr Flow (nothing needs to) — it reacts to text arriving in bursts and to the built-in mic.
 */
export function FlowBar({ state, hotkeyHint = "your Flow hotkey" }: { state: FlowState; hotkeyHint?: string }) {
  const active = state.kind === "mic" || state.kind === "heard" || state.kind === "ask";
  const label =
    state.kind === "ready" ? <>Flow ready — hold <b>{hotkeyHint}</b> and speak</>
    : state.kind === "mic" ? <>Listening — built-in mic</>
    : state.kind === "heard" ? <>{state.text}</>
    : state.kind === "ask" ? <><span className="text-safety">Answer:</span> {state.text}</>
    : null;

  return (
    <AnimatePresence>
      {state.kind !== "hidden" && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4"
        >
          <div className={cn("flex max-w-[min(680px,100%)] items-center gap-4 rounded-full border bg-paper/90 py-2.5 pl-3 pr-6 backdrop-blur-xl transition-colors", active ? "border-safety shadow-[0_0_0_4px_rgba(210,255,30,.1)]" : "border-line")}>
            <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-full", active ? "bg-safety text-on-safety" : "bg-ink/10 text-ink")}>
              {active && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-safety" />}
              <span className="relative flex h-4 items-center gap-[2px]" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.i key={i} className="block w-[2.5px] rounded-full bg-current" animate={{ height: active ? [4, 14, 6, 12, 4] : 4 }} transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: "easeInOut" }} />
                ))}
              </span>
            </span>
            <span className="min-w-0 truncate text-[14px] text-ink-2">{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
