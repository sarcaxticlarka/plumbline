"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Loader2, Mail, MailCheck, Send, Undo2, X } from "lucide-react";
import type { EventRecord } from "@/lib/domain/types";
import { describeClock, type NoticeClock } from "@/lib/domain/notice";
import { formatDate } from "@/lib/domain/dates";
import { CAUSE_LABEL, KIND_LABEL, PARTY_LABEL, STATE_STYLE, WEATHER_STYLE, cn } from "@/lib/format";
import { Button, Pill } from "@/components/ui";
import { ClockFace } from "./NoticeCard";
import { CopyButton } from "./CopyButton";

interface Item { event: EventRecord; clock: NoticeClock }
export interface Receipt {
  id: string;
  status: "sent" | "delivered" | "bounced" | "failed" | "preview";
  to: string[];
  provider: string;
  messageId: string | null;
  response: string | null;
  bodySha256: string;
  createdAt: string;
}

const RECEIPT_STYLE: Record<Receipt["status"], { label: string; chip: string }> = {
  delivered: { label: "Delivered", chip: "bg-ok-soft text-ok" },
  sent: { label: "Accepted by mail server", chip: "bg-ok-soft text-ok" },
  bounced: { label: "Bounced", chip: "bg-bad-soft text-bad" },
  failed: { label: "Send failed", chip: "bg-bad-soft text-bad" },
  preview: { label: "Not delivered — no email provider", chip: "bg-warn-soft text-warn" },
};

function ReceiptCard({ r }: { r: Receipt }) {
  const st = RECEIPT_STYLE[r.status];
  return (
    <div className="mt-3 border border-line bg-field p-3.5 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={st.chip}><MailCheck className="h-3 w-3" />{st.label}</Pill>
        <span className="label !text-[10px]">Delivery receipt · {r.provider}</span>
      </div>
      <dl className="mt-2.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-[110px_1fr]">
        <dt className="label !text-[9.5px]">To</dt><dd className="break-all">{r.to.join(", ")}</dd>
        <dt className="label !text-[9.5px]">When</dt><dd>{new Date(r.createdAt).toLocaleString()}</dd>
        {r.messageId && (<><dt className="label !text-[9.5px]">Message-ID</dt><dd className="hash break-all">{r.messageId}</dd></>)}
        {r.response && (<><dt className="label !text-[9.5px]">Server said</dt><dd className="text-ink-2">{r.response}</dd></>)}
        <dt className="label !text-[9.5px]">Body SHA-256</dt><dd className="hash break-all">{r.bodySha256}</dd>
      </dl>
    </div>
  );
}

interface Props {
  items: Item[];
  ownerEmail: string;
  canManage: boolean;
  canSend: boolean;
  mailMode: "smtp" | "resend" | "preview";
  receipts: Record<string, Receipt>;
}

export function NoticeBoard({ items, ownerEmail, canManage, canSend, mailMode, receipts }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<"action" | "all" | "done">("action");
  const [busy, setBusy] = useState<string | null>(null);
  const [letter, setLetter] = useState<{ id: string; subject: string; body: string } | null>(null);
  const [to, setTo] = useState(ownerEmail);
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ receipt: Receipt; delivered: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    setSent(null);
    setErr(null);
    setTo(ownerEmail);
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/letter`);
    if (res.ok) setLetter({ id, ...(await res.json()) });
    setBusy(null);
  }
  async function send() {
    if (!letter) return;
    setSending(true);
    setErr(null);
    const list = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    const res = await fetch(`/api/events/${encodeURIComponent(letter.id)}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: list(to), cc: list(cc), subject: letter.subject, body: letter.body }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok && !data.email) return setErr(data.error ?? "Couldn’t send");
    setSent({ receipt: data.email as Receipt, delivered: !!data.delivered });
    router.refresh();
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
            const receipt = receipts[e.id];
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
                    {receipt && <ReceiptCard r={receipt} />}
                  </div>
                  {canManage && (
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
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {shown.length === 0 && <div className="surface p-10 text-center text-mute">Nothing here. {filter === "action" ? "Every notice is handled — nice." : ""}</div>}
      </motion.div>

      <AnimatePresence>
        {letter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => setLetter(null)}>
            <motion.div initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="surface my-6 flex w-full max-w-2xl flex-col" onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div><div className="label">Draft notice — review before sending</div><div className="mt-1 text-[15px] font-semibold">{letter.subject}</div></div>
                <button onClick={() => setLetter(null)} aria-label="Close" className="p-1.5 hover:bg-ink/10"><X className="h-5 w-5" /></button>
              </div>

              {sent ? (
                <div className="p-5">
                  <div className={cn("border p-4 text-[14px]", sent.delivered ? "border-ok/40 bg-ok-soft text-ok" : sent.receipt.status === "preview" ? "border-warn/40 bg-warn-soft text-warn" : "border-bad/40 bg-bad-soft text-bad")}>
                    {sent.delivered ? "Sent. The notice is marked sent and the receipt is stored with the record." : sent.receipt.status === "preview" ? "Recorded — but NOT delivered. No email provider is configured, so this notice is still open. Copy the text and send it yourself, then mark it sent." : "Sending failed. The notice is still open."}
                  </div>
                  <ReceiptCard r={sent.receipt} />
                </div>
              ) : (
                <>
                  {canSend && (
                    <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2">
                      <label className="block"><span className="label">To</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="owner@company.com" className="mt-1.5 h-10 w-full border border-line bg-field px-3 text-[14px] outline-none focus:border-safety/70" /></label>
                      <label className="block"><span className="label">Cc (optional)</span><input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="you@company.com" className="mt-1.5 h-10 w-full border border-line bg-field px-3 text-[14px] outline-none focus:border-safety/70" /></label>
                      {mailMode === "preview" && <p className="text-[12.5px] text-warn sm:col-span-2">No email provider is configured on this server (set PLUMBLINE_SMTP_URL or RESEND_API_KEY). Sending will be recorded but not delivered, and the notice stays open.</p>}
                    </div>
                  )}
                  <textarea value={letter.body} onChange={(ev) => setLetter({ ...letter, body: ev.target.value })} className="hash min-h-[300px] flex-1 resize-none bg-field p-5 !text-[13px] leading-relaxed text-ink-2 outline-none" />
                  {err && <p className="mx-5 mb-3 border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
                  <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
                    <CopyButton value={letter.body} label="Copy" />
                    <Button variant="ghost" size="sm" onClick={download}><Download className="h-3.5 w-3.5" /> .txt</Button>
                    <a className="inline-flex h-8 items-center gap-2 border border-line px-3.5 font-mono text-[11px] uppercase tracking-[0.05em] hover:border-ink/50" href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body.slice(0, 1800))}`}><Mail className="h-3.5 w-3.5" /> Open mail app</a>
                    <div className="ml-auto flex gap-2">
                      <Button variant="ghost" size="sm" onClick={async () => { await patch(letter.id, "sent"); setLetter(null); }}>I sent it myself</Button>
                      {canSend && <Button variant="safety" size="sm" onClick={send} disabled={sending || !to.trim()}>{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send from Plumbline</Button>}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
