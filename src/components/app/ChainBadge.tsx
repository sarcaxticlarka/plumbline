"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Anchor, Download, Hammer, Mail, RotateCcw, ShieldAlert, ShieldCheck, Stamp } from "lucide-react";
import type { Integrity } from "@/lib/anchor/service";
import { cn, shortHash } from "@/lib/format";
import { formatDate } from "@/lib/domain/dates";
import { Button, Modal, Pill } from "@/components/ui";
import { CopyButton } from "./CopyButton";

type Busy = null | "verify" | "tamper" | "rewrite" | "reset" | "anchor";

export function ChainBadge({ projectId, integrity, demo, canAnchor, canExport }: { projectId: string; integrity: Integrity; demo: boolean; canAnchor: boolean; canExport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [flash, setFlash] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { chain, anchors } = integrity;
  const goodAnchors = anchors.filter((a) => a.ok);
  const brokenAnchor = anchors.find((a) => !a.ok);
  const clean = chain.ok && !brokenAnchor;

  async function call(kind: Exclude<Busy, null>, url: string, body?: unknown) {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (kind === "anchor") {
        const made: { status: string }[] = data.created ?? [];
        const real = made.filter((a) => a.status !== "preview").length;
        const errs: string[] = data.errors ?? [];
        setMsg({
          ok: res.ok && !errs.length,
          text: [
            real ? `${real} external anchor${real === 1 ? "" : "s"} recorded.` : "",
            made.length > real ? "Email recorded but not delivered (no email provider configured) — it doesn’t count as an anchor." : "",
            ...(data.skipped ?? []),
            ...errs,
            res.ok ? "" : data.error ?? "",
          ].filter(Boolean).join(" ") || "Nothing to do.",
        });
      }
      if (kind === "reset") router.push("/app"); // reseeding creates new project ids
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  async function verify() {
    setBusy("verify");
    await new Promise((r) => setTimeout(r, 450));
    await fetch(`/api/projects/${projectId}/verify`, { cache: "no-store" });
    router.refresh();
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
    setBusy(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <motion.div animate={flash ? { scale: [1, 1.06, 1] } : {}} className={cn("flex items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] font-medium", chain.ok ? "border-ok/30 bg-ok-soft text-ok" : "border-bad/40 bg-bad-soft text-bad")}>
          {chain.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {chain.ok ? <span>Chain verified · {chain.checked} entries · <span className="hash">{shortHash(chain.headHash, 6)}</span></span> : <span>Chain broken at entry #{chain.brokenAtSeq}</span>}
        </motion.div>
        <button onClick={() => setOpen(true)} data-cursor className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors", brokenAnchor ? "border-bad/40 bg-bad-soft text-bad" : goodAnchors.length ? "border-ok/30 bg-ok-soft text-ok hover:border-ok" : "border-warn/40 bg-warn-soft text-warn hover:border-warn")}>
          <Anchor className="h-4 w-4" />
          {brokenAnchor ? "Anchor mismatch — history rewritten" : goodAnchors.length ? `Anchored ${goodAnchors.length}× · latest #${Math.max(...goodAnchors.map((a) => a.headSeq))}` : "Not anchored yet"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={verify} disabled={busy !== null}>{busy === "verify" ? "Recomputing…" : "Verify now"}</Button>
        {canAnchor && clean && <Button variant="ghost" size="sm" onClick={() => { setOpen(true); call("anchor", `/api/projects/${projectId}/anchors`); }} disabled={busy !== null}><Stamp className="h-3.5 w-3.5" /> {busy === "anchor" ? "Anchoring…" : "Anchor now"}</Button>}
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Anchors ({anchors.length})</Button>
        {demo && (
          clean ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => call("tamper", "/api/demo/tamper", { projectId, mode: "edit" })} disabled={busy !== null} title="Edits a sealed entry directly in SQLite, bypassing the app"><Hammer className="h-3.5 w-3.5" /> Simulate tampering</Button>
              <Button variant="ghost" size="sm" onClick={() => call("rewrite", "/api/demo/tamper", { projectId, mode: "rewrite" })} disabled={busy !== null} title="Edits an entry AND recomputes every later hash, so the chain alone still verifies — only an anchor exposes it"><Hammer className="h-3.5 w-3.5" /> Rewrite whole chain</Button>
            </>
          ) : (
            <Button variant="safety" size="sm" onClick={() => call("reset", "/api/demo/reset")} disabled={busy !== null}><RotateCcw className="h-3.5 w-3.5" /> Restore demo data</Button>
          )
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="External anchors" wide>
        <div className="space-y-5 p-6">
          <p className="text-[14px] leading-relaxed text-ink-2">
            A hash chain proves the log is internally consistent. But someone with database access could edit an entry and <b className="text-ink">recompute every later hash</b>. An anchor defeats that: the chain-head fingerprint is <b className="text-ink">timestamped by an independent authority (RFC 3161)</b> and <b className="text-ink">emailed to the owner’s rep</b> — copies the operator can’t rewrite.
          </p>
          {msg && <div className={cn("border p-3 text-[13px]", msg.ok ? "border-ok/40 bg-ok-soft text-ok" : "border-warn/40 bg-warn-soft text-warn")}>{busy === "anchor" ? "Working…" : msg.text}</div>}
          {busy === "anchor" && !msg && <div className="text-[13px] text-mute">Asking the timestamp authority and emailing the fingerprint…</div>}
          {canAnchor && clean && <Button variant="safety" onClick={() => call("anchor", `/api/projects/${projectId}/anchors`)} disabled={busy !== null}><Stamp className="h-4 w-4" /> Anchor current head now</Button>}
          <div className="divide-y divide-line border-y border-line">
            {anchors.length === 0 && <div className="py-6 text-center text-[14px] text-mute">No anchors yet.</div>}
            <AnimatePresence initial={false}>
              {anchors.map((a) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={a.kind === "rfc3161" ? "bg-blue-soft text-blue" : "bg-paper-2 text-ink-2"}>{a.kind === "rfc3161" ? <Stamp className="h-3 w-3" /> : <Mail className="h-3 w-3" />}{a.kind === "rfc3161" ? "RFC 3161 timestamp" : "Emailed to owner’s rep"}</Pill>
                    <Pill className={a.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}>{a.ok ? "✓ head still matches" : "✕ mismatch"}</Pill>
                    {a.detail.demo === true && <Pill className="bg-paper-2 text-mute">demo record</Pill>}
                    <span className="ml-auto font-mono text-[11px] uppercase text-mute">entry #{a.headSeq} · {formatDate(a.createdAt.slice(0, 10))}</span>
                  </div>
                  <div className="hash mt-2 flex items-center gap-2 break-all text-ink-2">{a.headHash}<CopyButton value={a.headHash} /></div>
                  {!a.ok && <p className="mt-2 text-[13px] text-bad">{a.reason}</p>}
                  {a.kind === "rfc3161" && (
                    <div className="mt-2 space-y-1 text-[12.5px] text-mute">
                      <div>Stamped {String(a.detail.genTime ?? "—")} by {a.detail.tsa ? new URL(String(a.detail.tsa)).host : "TSA"}.</div>
                      {canExport && <a href={`/api/projects/${projectId}/anchors/${a.id}`} className="inline-flex items-center gap-1.5 text-ink underline underline-offset-4 hover:text-safety"><Download className="h-3 w-3" /> Download .tsr</a>}
                      <div className="hash">verify: openssl ts -verify -in anchor-{a.headSeq}.tsr -digest {String(a.detail.digestHex ?? "").slice(0, 16)}… -CAfile tsa-ca.pem</div>
                    </div>
                  )}
                  {a.kind === "email" && <div className="mt-2 text-[12.5px] text-mute">Sent to {String(a.detail.to ?? "—")}{a.detail.delivered === true ? "" : " (recorded)"}.</div>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function IntegrityBanner({ integrity }: { integrity: Integrity }) {
  const { chain, anchors } = integrity;
  const bad = anchors.find((a) => !a.ok);
  return (
    <AnimatePresence>
      {(!chain.ok || bad) && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="no-print overflow-hidden">
          <div className="mb-6 flex items-start gap-3 border border-bad/40 bg-bad-soft p-4 text-bad">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{!chain.ok ? "Integrity check failed — do not rely on this record." : "History was rewritten after it was anchored — do not rely on this record."}</div>
              <div className="mt-0.5 text-[14px] opacity-90">
                {!chain.ok ? <>{chain.reason} Entries before #{chain.brokenAtSeq} still verify.</> : <>The chain still links up, but {bad!.reason} An independent anchor caught what a hash chain alone cannot.</>}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
