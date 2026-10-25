import type { EventKindT } from "./schema";
import type { NoticeRules, NoticeState, NoticeStatus } from "./types";
import { addDays, diffDays } from "./dates";

/** RFIs are questions, not claim triggers. Everything else can start a notice clock. */
export const requiresNotice = (kind: EventKindT): boolean => kind !== "rfi";

export function noticeWindowDays(kind: EventKindT, rules: NoticeRules): number | null {
  switch (kind) {
    case "delay":
      return rules.delayNoticeDays;
    case "change":
    case "owner_direction":
      return rules.changeNoticeDays;
    case "differing_condition":
      return rules.differingConditionNoticeDays;
    case "rfi":
      return null;
  }
}

/** The clock starts on the day the event occurred (the log date) and runs in calendar days. */
export function noticeDueOn(kind: EventKindT, occurredOn: string, rules: NoticeRules): string | null {
  const days = noticeWindowDays(kind, rules);
  return days === null ? null : addDays(occurredOn, days);
}

export interface NoticeClock {
  state: NoticeState;
  daysLeft: number;
}

export function noticeClock(dueOn: string | null, today: string, status: NoticeStatus): NoticeClock | null {
  if (!dueOn) return null;
  const daysLeft = diffDays(today, dueOn);
  if (status === "sent") return { state: "sent", daysLeft };
  if (status === "waived") return { state: "waived", daysLeft };
  if (daysLeft < 0) return { state: "overdue", daysLeft };
  if (daysLeft === 0) return { state: "due_today", daysLeft };
  if (daysLeft <= 2) return { state: "critical", daysLeft };
  if (daysLeft <= 7) return { state: "soon", daysLeft };
  return { state: "open", daysLeft };
}

export const URGENCY_ORDER: NoticeState[] = ["overdue", "due_today", "critical", "soon", "open", "sent", "waived"];

export function describeClock(c: NoticeClock): string {
  switch (c.state) {
    case "sent":
      return "Notice sent";
    case "waived":
      return "Waived";
    case "overdue":
      return `${Math.abs(c.daysLeft)} day${Math.abs(c.daysLeft) === 1 ? "" : "s"} overdue`;
    case "due_today":
      return "Due today";
    default:
      return `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`;
  }
}
