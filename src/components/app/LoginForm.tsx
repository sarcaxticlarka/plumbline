"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/auth/permissions";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";

const field = "mt-1.5 h-11 w-full border border-line bg-field px-3.5 text-[14.5px] outline-none transition-colors focus:border-safety/70";

export function LoginForm({ demoUsers, next }: { demoUsers: { email: string; name: string; role: Role; blurb: string }[]; next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: unknown, tag: string) {
    setBusy(tag);
    setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(next);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="w-full">
      {demoUsers.length > 0 && (
        <div className="mb-8">
          <div className="label mb-3">One-click demo — pick a role</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {demoUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => post("/api/auth/demo", { email: u.email }, u.email)}
                disabled={busy !== null}
                data-cursor
                className="group border border-line p-4 text-left transition-colors hover:border-safety disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-safety">{ROLE_LABEL[u.role].replace(" (read-only)", "")}</span>
                  {busy === u.email && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>
                <div className="mt-2 text-[16px] font-semibold">{u.name}</div>
                <div className="text-[12.5px] text-mute">{u.blurb}</div>
              </button>
            ))}
          </div>
          <div className="my-8 flex items-center gap-4"><span className="h-px flex-1 bg-line" /><span className="label">or use your account</span><span className="h-px flex-1 bg-line" /></div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          post(mode === "in" ? "/api/auth/login" : "/api/auth/signup", mode === "in" ? { email: f.email, password: f.password } : f, "form");
        }}
        className="space-y-4"
      >
        <div className="flex gap-6 border-b border-line">
          {(["in", "up"] as const).map((m) => (
            <button type="button" key={m} onClick={() => { setMode(m); setErr(null); }} className={cn("relative pb-3 font-mono text-[12px] uppercase tracking-[0.06em]", mode === m ? "text-ink" : "text-mute hover:text-ink")}>
              {m === "in" ? "Sign in" : "Create account"}
              {mode === m && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-safety" />}
            </button>
          ))}
        </div>
        {mode === "up" && <label className="block"><span className="label">Your name</span><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" className={field} /></label>}
        <label className="block"><span className="label">Email</span><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" className={field} /></label>
        <label className="block"><span className="label">Password {mode === "up" && "(8+ characters)"}</span><input required type="password" minLength={mode === "up" ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === "in" ? "current-password" : "new-password"} className={field} /></label>
        {err && <p className="border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
        <Button type="submit" variant="safety" size="lg" disabled={busy !== null} className="w-full">{busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "in" ? "Sign in" : "Create account"}</Button>
        {mode === "up" && <p className="text-[12.5px] text-mute">If your project manager already invited this email, you’ll be added to their project automatically.</p>}
      </form>
    </div>
  );
}
