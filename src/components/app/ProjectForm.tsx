"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { RULE_PRESETS } from "@/lib/domain/types";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";

const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-field px-3.5 text-[14.5px] outline-none transition-colors focus:border-ink/40";

export function ProjectForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", address: "", client: "", contractor: "", contractRef: "", preset: "standard21" });
  const [geo, setGeo] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [loc, setLoc] = useState<{ label: string; lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function locate() {
    setLooking(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(f.address)}`);
    setGeo(await res.json());
    setLooking(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, lat: loc?.lat ?? null, lon: loc?.lon ?? null, rules: RULE_PRESETS[f.preset].rules }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Could not create the project");
      setBusy(false);
      return;
    }
    router.push(`/app/projects/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="surface mx-auto max-w-2xl space-y-5 p-6 md:p-8">
      <label className="block"><span className="label">Project name</span><input required minLength={2} value={f.name} onChange={set("name")} placeholder="Harbor Point Tower — Podium & Levels 3–6" className={field} /></label>

      <div>
        <span className="label">Site location <span className="normal-case tracking-normal">(city is enough — used for weather corroboration)</span></span>
        <div className="mt-1.5 flex gap-2">
          <input value={f.address} onChange={(e) => { set("address")(e); setLoc(null); }} placeholder="Jersey City, NJ" className={cn(field, "mt-0 flex-1")} />
          <Button type="button" variant="ghost" onClick={locate} disabled={f.address.length < 2 || looking}>{looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Locate</Button>
        </div>
        {geo.length > 0 && !loc && (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-field">
            {geo.map((g) => (
              <li key={g.label}><button type="button" onClick={() => { setLoc(g); setGeo([]); setF((s) => ({ ...s, address: g.label })); }} className="w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-paper-2">{g.label} <span className="hash text-mute">{g.lat.toFixed(2)}, {g.lon.toFixed(2)}</span></button></li>
            ))}
          </ul>
        )}
        {loc && <p className="mt-2 text-[13px] text-ok">✓ Weather will be measured at {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}</p>}
        {!loc && <p className="mt-2 text-[12.5px] text-mute">Without a location, weather claims can’t be corroborated.</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="label">Owner / client</span><input value={f.client} onChange={set("client")} className={field} /></label>
        <label className="block"><span className="label">Your company</span><input value={f.contractor} onChange={set("contractor")} className={field} /></label>
      </div>
      <label className="block"><span className="label">Contract reference</span><input value={f.contractRef} onChange={set("contractRef")} placeholder="AIA A201-2017 / Agreement dated…" className={field} /></label>

      <div>
        <span className="label">Notice windows <span className="normal-case tracking-normal">— check these against your contract</span></span>
        <div className="mt-2 grid gap-2">
          {Object.entries(RULE_PRESETS).map(([k, p]) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors", f.preset === k ? "border-ink bg-white" : "border-line hover:border-ink/30")}>
              <input type="radio" name="preset" checked={f.preset === k} onChange={() => setF((s) => ({ ...s, preset: k }))} className="accent-[var(--color-safety)]" />
              <span className="flex-1 text-[14.5px] font-medium">{p.label}</span>
              <span className="hash text-mute">{p.rules.delayNoticeDays}/{p.rules.changeNoticeDays}/{p.rules.differingConditionNoticeDays} d</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-mute">Delay / change / differing-condition notice periods, in calendar days from the day the event occurs.</p>
      </div>

      {err && <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
      <Button type="submit" variant="safety" size="lg" disabled={busy || f.name.trim().length < 2} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create project</Button>
    </form>
  );
}
