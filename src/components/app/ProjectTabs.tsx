"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarClock, FileText, Users } from "lucide-react";
import { cn } from "@/lib/format";

export function ProjectTabs({ id, urgent }: { id: string; urgent: number }) {
  const path = usePathname();
  const base = `/app/projects/${id}`;
  const tabs = [
    { href: base, label: "Logbook", icon: BookOpen, active: path === base || path.startsWith(`${base}/logs`) || path === `${base}/new` },
    { href: `${base}/notices`, label: "Notices", icon: CalendarClock, active: path.startsWith(`${base}/notices`), badge: urgent },
    { href: `${base}/packet`, label: "Claim packet", icon: FileText, active: path.startsWith(`${base}/packet`) },
    { href: `${base}/team`, label: "Team", icon: Users, active: path.startsWith(`${base}/team`) },
  ];
  return (
    <div className="no-print mb-8 flex gap-0 overflow-x-auto border-b border-line md:gap-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-mono md:px-4 text-[12px] uppercase tracking-[0.06em] transition-colors",
            t.active ? "text-ink" : "text-mute hover:text-ink",
          )}
        >
          <t.icon className="h-4 w-4" />
          {t.label}
          {!!t.badge && <span className="grid h-5 min-w-5 place-items-center bg-safety px-1.5 text-[11px] font-bold text-on-safety">{t.badge}</span>}
          {t.active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-safety" />}
        </Link>
      ))}
    </div>
  );
}
