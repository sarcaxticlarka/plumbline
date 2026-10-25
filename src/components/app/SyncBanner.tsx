"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CloudOff, Loader2, RefreshCw, Trash2, Check } from "lucide-react";
import { flushOutbox, listOutbox, onOutboxChange, removeItem, retryItem, type OutboxItem } from "@/lib/offline/outbox";
import { aiHeaders } from "@/lib/ai/client-config";
import { cn } from "@/lib/format";

/**
 * Sits at the top of the app. Shows connectivity, how many entries are waiting on this device, and syncs them
 * (automatically on reconnect, and on a timer while online).
 */
export function SyncBanner() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const refresh = useCallback(async () => setItems(await listOutbox().catch(() => [])), []);
  const queued = items.filter((i) => i.status === "queued");
  const failed = items.filter((i) => i.status === "failed");

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const r = await flushOutbox(aiHeaders);
    setSyncing(false);
    await refresh();
    if (r.sealed) {
      setDone(`${r.sealed} offline ${r.sealed === 1 ? "entry" : "entries"} sealed ✓`);
      router.refresh();
      setTimeout(() => setDone(null), 6000);
    }
  }, [syncing, refresh, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    refresh();
    const unsub = onOutboxChange(refresh);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); unsub(); };
  }, [refresh]);

  useEffect(() => {
    if (!online || !queued.length) return;
    sync();
    const id = setInterval(sync, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queued.length]);

  const show = !online || items.length > 0 || done;
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="no-print sticky top-0 z-40 overflow-hidden">
          <div className={cn("border-b px-5 py-2.5 md:px-10", !online ? "border-warn/40 bg-[#1a1608]" : done ? "border-ok/40 bg-[#0b1a11]" : "border-line bg-paper-2")}>
            <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className={cn("flex items-center gap-2 font-medium", !online ? "text-warn" : done ? "text-ok" : "text-ink")}>
                {!online ? <CloudOff className="h-4 w-4" /> : syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {done ?? (!online ? "You’re offline — keep dictating, entries are saved on this device." : syncing ? "Sealing offline entries…" : `${queued.length} offline ${queued.length === 1 ? "entry" : "entries"} waiting to seal`)}
              </span>
              {!online && queued.length > 0 && <span className="text-mute">{queued.length} waiting</span>}
              {online && queued.length > 0 && !syncing && <button onClick={sync} className="font-mono text-[11px] uppercase tracking-[0.06em] underline underline-offset-4 hover:text-safety">Sync now</button>}
            </div>
            {failed.map((f) => (
              <div key={f.id} className="mx-auto mt-1.5 flex max-w-[1180px] flex-wrap items-center gap-3 text-[12.5px] text-bad">
                <span>✕ An offline entry couldn’t be sealed: {f.error}</span>
                <button onClick={() => retryItem(f.id).then(sync)} className="underline underline-offset-4">Retry</button>
                <button onClick={() => removeItem(f.id)} className="flex items-center gap-1 text-mute hover:text-bad"><Trash2 className="h-3 w-3" /> Discard</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
