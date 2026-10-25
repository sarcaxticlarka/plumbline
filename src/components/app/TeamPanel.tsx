"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import { ROLES, ROLE_BLURB, ROLE_LABEL, type Role } from "@/lib/auth/permissions";
import { Button, Pill } from "@/components/ui";
import { cn } from "@/lib/format";

interface Member { user: { id: string; name: string; email: string }; role: Role }
interface Invite { id: string; email: string; role: Role }

export function TeamPanel({ projectId, members, invites, canManage, meId }: { projectId: string; members: Member[]; invites: Invite[]; canManage: boolean; meId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("superintendent");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", qs = "", body?: unknown) {
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await fetch(`/api/projects/${projectId}/team${qs}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Couldn’t update the team");
    if (method === "POST") setNote(data.joined ? "Added — they have access now." : "Invited — they’ll get access when they sign up with that email.");
    router.refresh();
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="border-b border-ink pb-3"><h2 className="cond text-[40px]">People on this project</h2></div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user.id} className="flex flex-wrap items-center gap-4 py-4">
              <span className="grid h-10 w-10 place-items-center bg-paper-2 font-mono text-[12px] font-bold">{m.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.user.name} {m.user.id === meId && <span className="text-mute">(you)</span>}</div>
                <div className="text-[13px] text-mute">{m.user.email}</div>
              </div>
              {canManage ? (
                <select value={m.role} disabled={busy} onChange={(e) => call("POST", "", { email: m.user.email, role: e.target.value })} className="h-9 border border-line bg-paper px-2 font-mono text-[11px] uppercase tracking-[0.04em]">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : <Pill className="bg-paper-2 text-ink-2">{ROLE_LABEL[m.role]}</Pill>}
              {canManage && m.user.id !== meId && <button onClick={() => call("DELETE", `?userId=${m.user.id}`)} disabled={busy} aria-label={`Remove ${m.user.name}`} className="grid h-9 w-9 place-items-center border border-line text-mute hover:border-bad hover:text-bad"><X className="h-4 w-4" /></button>}
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-4 py-4 opacity-80">
              <span className="grid h-10 w-10 place-items-center border border-dashed border-line"><Mail className="h-4 w-4 text-mute" /></span>
              <div className="min-w-0 flex-1"><div className="font-medium">{i.email}</div><div className="text-[13px] text-mute">Pending invite — activates when they sign up</div></div>
              <Pill className="bg-paper-2 text-ink-2">{ROLE_LABEL[i.role]}</Pill>
              {canManage && <button onClick={() => call("DELETE", `?inviteId=${i.id}`)} disabled={busy} aria-label="Cancel invite" className="grid h-9 w-9 place-items-center border border-line text-mute hover:border-bad hover:text-bad"><X className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>

        {canManage ? (
          <form onSubmit={(e) => { e.preventDefault(); call("POST", "", { email, role }); setEmail(""); }} className="mt-6 flex flex-wrap items-end gap-3 border border-line p-4">
            <label className="min-w-[220px] flex-1"><span className="label">Add by email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="mt-1.5 h-11 w-full border border-line bg-field px-3.5 text-[14px] outline-none focus:border-safety/70" /></label>
            <label><span className="label">Role</span><select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1.5 block h-11 border border-line bg-paper px-3 text-[14px]">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
            <Button type="submit" variant="safety" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button>
            {err && <p className="w-full text-[13px] text-bad">{err}</p>}
            {note && <p className="w-full text-[13px] text-ok">{note}</p>}
          </form>
        ) : <p className="mt-6 text-[13px] text-mute">Only project managers can change the team.</p>}
      </div>

      <div>
        <div className="border-b border-ink pb-3"><h2 className="cond text-[40px]">What each role can do</h2></div>
        <ul className="divide-y divide-line">
          {ROLES.map((r) => (
            <li key={r} className="py-4">
              <div className={cn("font-mono text-[11px] uppercase tracking-[0.06em]", "text-safety")}>{ROLE_LABEL[r]}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{ROLE_BLURB[r]}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
