import Link from "next/link";
import { ArrowUpRight, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { portfolio, sortedNotices } from "@/lib/services";
import { todayLocal, formatDate } from "@/lib/domain/dates";
import { NoticeCard } from "@/components/app/NoticeCard";
import { ResetDemo } from "@/components/app/DemoControls";
import { CountUp, LinkButton, ScoreRing } from "@/components/ui";
import { demoEnabled } from "@/lib/api";
import { cn, shortHash } from "@/lib/format";

export const metadata = { title: "Site control" };

export default async function Dashboard() {
  const today = todayLocal();
  const all = await portfolio(today);
  const urgent = all
    .flatMap((o) => sortedNotices(o.events, today).map((n) => ({ ...n, project: o.project })))
    .filter((n) => !["sent", "waived"].includes(n.clock.state))
    .sort((a, b) => a.clock.daysLeft - b.clock.daysLeft)
    .slice(0, 6);

  const overdue = all.reduce((s, o) => s + o.overdueNotices, 0);
  const soon = all.reduce((s, o) => s + o.urgentNotices, 0);
  const hours = all.reduce((s, o) => s + o.delayHours, 0);
  const logs = all.reduce((s, o) => s + o.logCount, 0);
  const avg = logs ? Math.round(all.reduce((s, o) => s + o.avgScore * o.logCount, 0) / logs) : 0;

  const kpis = [
    { label: "Notices overdue", value: overdue, tone: overdue ? "text-bad" : "text-ok", note: overdue ? "Act today — rights may be at risk" : "Nothing late" },
    { label: "Due within a week", value: soon, tone: soon ? "text-safety" : "text-ok", note: "Clocks running" },
    { label: "Delay hours on record", value: hours, tone: "text-ink", note: `${logs} sealed log entries` },
    { label: "Avg evidence score", value: avg, tone: avg >= 80 ? "text-ok" : avg >= 55 ? "text-warn" : "text-bad", note: "Across all entries" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label flex items-center gap-2.5"><span className="h-[7px] w-[7px] bg-safety" />{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="cond mt-4 text-[clamp(64px,10vw,168px)]">Site control</h1>
        </div>
        <div className="flex gap-2 pb-2">
          {demoEnabled() && <ResetDemo />}
          <LinkButton href="/app/projects/new" variant="ghost" size="sm"><Plus className="h-3.5 w-3.5" /> New project</LinkButton>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 border-y border-ink lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={cn("border-line p-5 md:p-7", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b lg:border-b-0" : "", "lg:border-r lg:last:border-r-0")}>
            <div className="label">{k.label}</div>
            <div className={cn("cond mt-6 text-[clamp(72px,8.4vw,140px)] leading-[0.8]", k.tone)}><CountUp value={k.value} /></div>
            <div className="mt-4 text-[12.5px] text-mute">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.35fr_1fr]">
        <section className="min-w-0">
          <div className="mb-2 flex items-end justify-between border-b border-ink pb-3">
            <h2 className="cond text-[44px]">Notice clock</h2>
            <span className="label">most urgent first</span>
          </div>
          {urgent.length === 0 ? (
            <div className="border-b border-line py-12 text-center text-mute">No open notice clocks. Dictate today’s log to start tracking.</div>
          ) : (
            <div>
              {urgent.map((n) => (
                <NoticeCard key={n.event.id} event={n.event} clock={n.clock} projectName={n.project.name.split(" — ")[0]} href={`/app/projects/${n.project.id}/notices`} />
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-2 flex items-end justify-between border-b border-ink pb-3">
            <h2 className="cond text-[44px]">Projects</h2>
            <span className="label">{all.length} active</span>
          </div>
          <div>
            {all.map((o, i) => (
              <Link key={o.project.id} href={`/app/projects/${o.project.id}`} className="group -mx-3 block border-b border-line px-3 py-6 transition-colors hover:bg-field">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[11px] text-mute">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="display text-[26px] !font-bold leading-[1] tracking-[-0.035em] transition-colors group-hover:text-safety">{o.project.name.split(" — ")[0]}</div>
                    <div className="mt-1.5 text-[13px] text-mute">{o.project.name.split(" — ")[1] ?? o.project.address} · last entry {o.lastLogDate ? formatDate(o.lastLogDate, { month: "short", day: "numeric" }) : "—"}</div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11.5px] uppercase tracking-[0.04em] text-ink-2">
                      <span><b className="text-ink">{o.logCount}</b> entries</span>
                      <span><b className="text-ink">{o.events.length}</b> events</span>
                      <span><b className="text-ink">{o.delayHours}</b> h delay</span>
                      <span className={cn("flex items-center gap-1.5", o.chain.ok ? "text-ok" : "text-bad")}>
                        {o.chain.ok ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                        {o.chain.ok ? shortHash(o.chain.headHash, 6) : `broken #${o.chain.brokenAtSeq}`}
                      </span>
                    </div>
                  </div>
                  <ScoreRing score={o.avgScore} size={56} stroke={5} />
                  <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-mute transition-all duration-300 group-hover:rotate-45 group-hover:text-safety" />
                </div>
              </Link>
            ))}
            <Link href="/app/projects/new" className="group flex items-center justify-between py-6 font-mono text-[12px] uppercase tracking-[0.06em] text-mute transition-colors hover:text-safety">
              Start a project <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
