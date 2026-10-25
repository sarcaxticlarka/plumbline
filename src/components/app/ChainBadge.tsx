"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hammer, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ChainResult } from "@/lib/domain/types";
import { cn, shortHash } from "@/lib/format";
import { Button } from "@/components/ui";

export function ChainBadge({ projectId, chain, demo }: { projectId: string; chain: ChainResult; demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "verify" | "tamper" | "reset">(null);
  const [flash, setFlash] = useState(false);

  async function verify() {
    setBusy("verify");
    await new Promise((r) => setTimeout(r, 450));
    await fetch(`/api/projects/${projectId}/verify`, { cache: "no-store" });
    router.refresh();
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
    setBusy(null);
  }
  async function tamper() {
    setBusy("tamper");
    await fetch("/api/demo/tamper", { method: "POST", body: JSON.stringify({ projectId }) });
    router.refresh();
    setBusy(null);
  }
  async function reset() {
    setBusy("reset");
    await fetch("/api/demo/reset", { method: "POST" });
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.div
        animate={flash ? { scale: [1, 1.06, 1] } : {}}
        className={cn("flex items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] font-medium", chain.ok ? "border-ok/30 bg-ok-soft text-ok" : "border-bad/40 bg-bad-soft text-bad")}
      >
        {chain.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        {chain.ok ? (
          <span>
            Chain verified · {chain.checked} entries · <span className="hash">{shortHash(chain.headHash, 6)}</span>
          </span>
        ) : (
          <span>Chain broken at entry #{chain.brokenAtSeq}</span>
        )}
      </motion.div>
      <Button variant="ghost" size="sm" onClick={verify} disabled={busy !== null}>
        {busy === "verify" ? "Recomputing hashes…" : "Verify now"}
      </Button>
      {demo && (
        <>
          {chain.ok ? (
            <Button variant="ghost" size="sm" onClick={tamper} disabled={busy !== null} title="Demo: edits a sealed entry directly in SQLite, bypassing the app">
              <Hammer className="h-3.5 w-3.5" /> Simulate tampering
            </Button>
          ) : (
            <Button variant="safety" size="sm" onClick={reset} disabled={busy !== null}>
              <RotateCcw className="h-3.5 w-3.5" /> Restore demo data
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function IntegrityBanner({ chain }: { chain: ChainResult }) {
  return (
    <AnimatePresence>
      {!chain.ok && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="no-print overflow-hidden"
        >
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-bad/40 bg-bad-soft p-4 text-bad">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Integrity check failed — do not rely on this record.</div>
              <div className="mt-0.5 text-[14px] opacity-90">{chain.reason} Entries before #{chain.brokenAtSeq} still verify.</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
