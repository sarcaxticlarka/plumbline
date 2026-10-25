"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Loader2, Mail, Send, Undo2, X } from "lucide-react";
import type { EventRecord } from "@/lib/domain/types";
import { describeClock, type NoticeClock } from "@/lib/domain/notice";
import { formatDate } from "@/lib/domain/dates";
import { CAUSE_LABEL, KIND_LABEL, PARTY_LABEL, STATE_STYLE, WEATHER_STYLE, cn } from "@/lib/format";
import { Button, Pill } from "@/components/ui";
import { ClockFace } from "./NoticeCard";
import { CopyButton } from "./CopyButton";

interface Item { event: EventRecord; clock: NoticeClock }

export function NoticeBoard({ items }: { items: Item[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"action" | "all" | "done">("action");
  const [busy, setBusy] = useState<string | null>(null);
  const [letter, setLetter] = useState<{ id: string; subject: string; body: string } | null>(null);

  const done = (i: Item) => i.clock.state === "sent" || i.clock.state === "waived";
  const shown = items.filter((i) => (filter === "all" ? true : filter === "done" ? done(i) : !done(i)));

  async function patch(id: string, noticeStatus: "open" | "sent" | "waived") {
    setBusy(id);
    await fetch(`/api/events/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ noticeStatus }) });
    router.refresh();
    setBusy(null);
  }
  async function draft(id: string) {
    setBusy(id);
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/letter`);
    if (res.ok) setLetter({ id, ...(await res.json()) });
    setBusy(null);
  }
  function download() {
    if (!letter) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([letter.body], { type: "text/plain" }));
    a.download = `notice-${letter.id.replace(/[^a-z0-9]/gi, "-")}.txt`;
    a.click();
  }

  return (
    <div>
      <div className="mb-5 flex gap-1.5">
        {([["action", "Needs action"], ["all", "All"], ["done", "Sent / waived"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors", filter === k ? "bg-ink text-paper" : "border border-line text-ink-2 hover:border-ink/40")}>
            {l} <span className="opacity-60">{items.filter((i) => (k === "all" ? true : k === "done" ? done(i) : !done(i))).length}</span>
          </button>
        ))}
      </div>

      <motion.div layout className="space-y-3">
        <AnimatePresence initial={false}>
          {shown.map(({ event: e, clock }) => {
            const st = STATE_STYLE[clock.state];
            const wv = WEATHER_STYLE[e.weatherVerdict];
            return (
              <motion.div key={e.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="surface relative overflow-hidden p-5">
                <span className={cn("absolute inset-y-0 left-0 w-1.5", st.bar)} />
                <div className="flex flex-wrap items-start gap-5 pl-2">
                  <ClockFace clock={clock} size={84} />
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className={st.chip}>{describeClock(clock)}</Pill>
                      <span className="label !text-[10.5px]">Log #{e.logSeq} · {KIND_LABEL[e.kind]}</span>
                    </div>
                    <h3 className="mt-2 text-[17px] font-semibold">{e.title}</h3>
                    <p className="mt-1 text-[14px] text-ink-2">{e.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill className="bg-paper-2 text-ink-2">Occurred {formatDate(e.occurredOn, { month: "short", day: "numeric" })}</Pill>
                      <Pill className="bg-paper-2 text-ink-2">Notice due {formatDate(e.noticeDueOn!, { month: "short", day: "numeric" })}</Pill>
                      <Pill className="bg-paper-2 text-ink-2">{CAUSE_LABEL[e.cause]}</Pill>
                      <Pill className="bg-paper-2 text-ink-2">{PARTY_LABEL[e.responsibleParty]}</Pill>
                      {e.hoursLost !== null && <Pill className="bg-paper-2 text-ink-2">{e.hoursLost} h</Pill>}
                      {wv.label && <Pill className={wv.chip}>{wv.label}</Pill>}
                      <Pill className={e.evidenceScore >= 80 ? "bg-ok-soft text-ok" : e.evidenceScore >= 55 ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad"}>Evidence {e.evidenceScore}</Pill>
                    </div>
                    {e.noticeSentOn && <p className="mt-2 text-[12.5px] text-ok">Notice sent {formatDate(e.noticeSentOn)}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {clock.state !== "sent" && clock.state !== "waived" ? (
                      <>
                        <Button variant="safety" size="sm" onClick={() => draft(e.id)} disabled={busy === e.id}>
                          {busy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Draft notice
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => patch(e.id, "sent")} disabled={busy === e.id}><Send className="h-3.5 w-3.5" /> Mark sent</Button>
                        <Button variant="ghost" size="sm" onClick={() => patch(e.id, "waived")} disabled={busy === e.id}>Waive</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => patch(e.id, "open")} disabled={busy === e.id}><Undo2 className="h-3.5 w-3.5" /> Reopen</Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {shown.length === 0 && <div className="surface p-10 text-center text-mute">Nothing here. {filter === "action" ? "Every notice is handled — nice." : ""}</div>}
      </motion.div>

      <AnimatePresence>
        {letter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-night/60 p-4 backdrop-blur-sm" onClick={() => setLetter(null)}>
            <motion.div initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="surface flex max-h-[88vh] w-full max-w-2xl flex-col" onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div>
                  <div className="label">Draft notice — review before sending</div>
                  <div className="mt-1 text-[15px] font-semibold">{letter.subject}</div>
                </div>
                <button onClick={() => setLetter(null)} aria-label="Close" className="rounded-full p-1.5 hover:bg-ink/10"><X className="h-5 w-5" /></button>
              </div>
              <textarea value={letter.body} onChange={(ev) => setLetter({ ...letter, body: ev.target.value })} className="hash min-h-[320px] flex-1 resize-none bg-field p-5 !text-[13px] leading-relaxed text-ink-2 outline-none" />
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
                <CopyButton value={letter.body} label="Copy" />
                <Button variant="ghost" size="sm" onClick={download}><Download className="h-3.5 w-3.5" /> .txt</Button>
                <a className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-medium hover:border-ink/40" href={`mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body.slice(0, 1800))}`}><Mail className="h-3.5 w-3.5" /> Open in email</a>
                <Button size="sm" className="ml-auto" onClick={async () => { await patch(letter.id, "sent"); setLetter(null); }}><Send className="h-3.5 w-3.5" /> I sent it — mark sent</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
