import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { EventRecord, NoticeState } from "@/lib/domain/types";
import { describeClock, type NoticeClock } from "@/lib/domain/notice";
import { formatDate } from "@/lib/domain/dates";
import { CAUSE_LABEL, KIND_LABEL, STATE_STYLE, cn } from "@/lib/format";
import { Pill } from "@/components/ui";

/** The countdown as a big condensed numeral: the one number a superintendent must not miss. */
export function ClockFace({ clock, size = 76 }: { clock: NoticeClock; size?: number }) {
  const st = STATE_STYLE[clock.state];
  const done = clock.state === "sent" || clock.state === "waived";
  const big = done ? "✓" : clock.state === "overdue" ? Math.abs(clock.daysLeft) : clock.daysLeft;
  const unit = done ? (clock.state === "sent" ? "sent" : "waived") : clock.state === "overdue" ? "days late" : clock.daysLeft === 1 ? "day left" : "days left";
  return (
    <div className="flex shrink-0 flex-col items-start justify-center" style={{ width: size }}>
      <div className={cn("cond tnum leading-[0.8]", st.text)} style={{ fontSize: size * 0.82 }}>{big}</div>
      <div className="label mt-2 !text-[9.5px]">{unit}</div>
    </div>
  );
}

export function NoticeCard({ event, clock, projectName, href }: { event: EventRecord; clock: NoticeClock; projectName?: string; href: string }) {
  const st = STATE_STYLE[clock.state as NoticeState];
  return (
    <Link href={href} className="group -mx-3 flex min-w-0 items-center gap-6 border-b border-line px-3 py-5 transition-colors hover:bg-field">
      <ClockFace clock={clock} size={92} />
      <div className="min-w-0 flex-1">
        {projectName && <div className="label !text-[10px]">{projectName}</div>}
        <div className="mt-1 truncate text-[18px] font-semibold leading-tight tracking-[-0.01em]">{event.title}</div>
        <div className="mt-1 text-[13px] text-mute">
          {KIND_LABEL[event.kind]} · {formatDate(event.occurredOn, { month: "short", day: "numeric" })} → notice due {formatDate(event.noticeDueOn!, { month: "short", day: "numeric" })}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill className={st.chip}>{describeClock(clock)}</Pill>
          <Pill className="bg-paper-2 text-ink-2">{CAUSE_LABEL[event.cause]}</Pill>
          {event.hoursLost !== null && <Pill className="bg-paper-2 text-ink-2">{event.hoursLost} h</Pill>}
        </div>
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-mute transition-all duration-300 group-hover:rotate-45 group-hover:text-safety" />
    </Link>
  );
}
