"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-2 hover:border-ink/40"
      aria-label="Copy"
    >
      {done ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
      {label && (done ? "Copied" : label)}
    </button>
  );
}
