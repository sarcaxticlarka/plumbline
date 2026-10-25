"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Settings, ShieldAlert, ShieldCheck } from "lucide-react";
import { EngineChip } from "./EngineChip";
import { UserMenu } from "./UserMenu";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/format";

export interface NavProject {
  id: string;
  name: string;
  intact: boolean;
  urgent: number;
}

export function SideNav({ projects, engine, user }: { projects: NavProject[]; engine: { label: string; live: boolean }; user: { name: string; email: string } }) {
  const path = usePathname();
  const item = (active: boolean) =>
    cn(
      "group relative flex items-center gap-2.5 px-3 py-2.5 text-[13.5px] transition-colors",
      active ? "bg-field text-ink before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-safety" : "text-ink-2 hover:bg-field hover:text-ink",
    );
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
      <div className="px-2"><Logo href="/" /></div>
      <nav className="mt-8 space-y-1">
        <Link href="/app" className={item(path === "/app")}>
          <LayoutGrid className="h-4 w-4" /> Site control
        </Link>
      </nav>
      <div className="label mt-8 px-3">Projects</div>
      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto">
        {projects.map((p) => {
          const active = path.startsWith(`/app/projects/${p.id}`);
          return (
            <Link key={p.id} href={`/app/projects/${p.id}`} className={item(active)}>
              {p.intact ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-ok" />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0 text-bad" />
              )}
              <span className="min-w-0 flex-1 truncate">{p.name.split(" — ")[0]}</span>
              {p.urgent > 0 && (
                <span className="grid h-5 min-w-5 place-items-center bg-safety px-1.5 font-mono text-[11px] font-bold text-on-safety">
                  {p.urgent}
                </span>
              )}
            </Link>
          );
        })}
        <Link href="/app/projects/new" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-mute hover:text-ink">
          <Plus className="h-4 w-4" /> New project
        </Link>
      </nav>
      <Link href="/app/settings" className={item(path === "/app/settings")}>
        <Settings className="h-4 w-4" /> Settings &amp; keys
      </Link>
      <EngineChip server={engine} />
      <UserMenu name={user.name} email={user.email} />
    </aside>
  );
}

export function MobileBar({ projects }: { projects: NavProject[] }) {
  return (
    <div className="no-print sticky top-0 z-40 flex items-center gap-3 overflow-x-auto border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
      <Logo href="/" />
      <div className="ml-auto flex gap-2 text-[13px]">
        <Link href="/app" className="rounded-full border border-line px-3 py-1.5">Control</Link>
        <Link href="/app/settings" className="rounded-full border border-line px-3 py-1.5">Keys</Link>
        {projects.map((p) => (
          <Link key={p.id} href={`/app/projects/${p.id}`} className="whitespace-nowrap rounded-full border border-line px-3 py-1.5">
            {p.name.split(" — ")[0]}
          </Link>
        ))}
      </div>
    </div>
  );
}
