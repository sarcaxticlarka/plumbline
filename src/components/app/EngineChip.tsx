"use client";
import { useState } from "react";
import { Cpu } from "lucide-react";
import { useAiConfig } from "@/lib/ai/client-config";
import { Modal } from "@/components/ui";
import { AiSettings } from "./AiSettings";
import { cn } from "@/lib/format";

export function useEngineLabel(server: { live: boolean; label: string }) {
  const c = useAiConfig();
  if (!c) return { own: false, live: server.live, label: server.label };
  if (c.provider === "offline") return { own: true, live: false, label: "Offline engine (your choice)" };
  if (c.provider === "anthropic") return { own: true, live: true, label: `Claude · ${c.model} · your key` };
  return { own: true, live: true, label: `${c.model} · your API` };
}

export function EngineChip({ server, variant = "card" }: { server: { live: boolean; label: string }; variant?: "card" | "inline" }) {
  const [open, setOpen] = useState(false);
  const e = useEngineLabel(server);
  return (
    <>
      {variant === "card" ? (
        <button onClick={() => setOpen(true)} data-cursor className="mt-4 w-full border border-line p-3.5 text-left transition-colors hover:border-ink/50">
          <div className="label !text-[10px]">Extraction engine</div>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] font-medium">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", e.live ? "bg-ok" : "bg-warn")} />
            <span className="truncate">{e.label}</span>
          </div>
          <div className="mt-1 text-[11.5px] leading-snug text-mute">{e.own ? "Click to change or remove your key." : e.live ? "Server key. Click to use your own." : "Add your own API key →"}</div>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} data-cursor className="flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-ink-2 transition-colors hover:border-ink/50 hover:text-ink">
          <Cpu className="h-3.5 w-3.5" />
          <span className={cn("h-1.5 w-1.5 rounded-full", e.live ? "bg-ok" : "bg-warn")} />
          <span className="max-w-[220px] truncate">{e.label}</span>
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Bring your own API key" wide>
        <AiSettings onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
