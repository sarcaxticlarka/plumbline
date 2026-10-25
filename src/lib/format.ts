import type { CauseT, EventKindT, PartyT } from "@/lib/domain/schema";
import type { NoticeState, WeatherVerdict } from "@/lib/domain/types";

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const shortHash = (h: string, n = 8) => (h.length > n + 4 ? `${h.slice(0, n)}…${h.slice(-4)}` : h);

export const CAUSE_LABEL: Record<CauseT, string> = {
  weather: "Weather",
  design: "Design / RFI",
  owner: "Owner",
  inspection: "Inspection / permit",
  material: "Material delivery",
  utility: "Utility",
  subcontractor: "Subcontractor",
  differing_condition: "Differing condition",
  scope_change: "Scope change",
  access: "Access",
  equipment: "Equipment",
  other: "Unspecified",
};

export const PARTY_LABEL: Record<PartyT, string> = {
  owner: "Owner",
  architect: "Architect / Engineer",
  gc: "General contractor",
  subcontractor: "Subcontractor",
  supplier: "Supplier",
  utility: "Utility",
  authority: "Authority",
  weather: "Weather",
  unknown: "Not stated",
};

export const KIND_LABEL: Record<EventKindT, string> = {
  delay: "Delay",
  change: "Change",
  differing_condition: "Differing condition",
  owner_direction: "Directive",
  rfi: "RFI",
};

export const STATE_STYLE: Record<NoticeState, { label: string; chip: string; bar: string; text: string }> = {
  overdue: { label: "Overdue", chip: "bg-bad text-black", bar: "bg-bad", text: "text-bad" },
  due_today: { label: "Due today", chip: "bg-bad text-black", bar: "bg-bad", text: "text-bad" },
  critical: { label: "Critical", chip: "bg-safety text-on-safety", bar: "bg-safety", text: "text-safety" },
  soon: { label: "Due soon", chip: "bg-warn-soft text-warn", bar: "bg-warn", text: "text-warn" },
  open: { label: "Open", chip: "bg-paper-2 text-ink-2", bar: "bg-ink/25", text: "text-ink-2" },
  sent: { label: "Sent", chip: "bg-ok-soft text-ok", bar: "bg-ok", text: "text-ok" },
  waived: { label: "Waived", chip: "bg-paper-2 text-mute", bar: "bg-ink/15", text: "text-mute" },
};

export const WEATHER_STYLE: Record<WeatherVerdict, { label: string; chip: string }> = {
  corroborated: { label: "Weather record supports", chip: "bg-ok-soft text-ok" },
  not_supported: { label: "Weather record doesn’t show it", chip: "bg-warn-soft text-warn" },
  unavailable: { label: "No weather record", chip: "bg-paper-2 text-mute" },
  not_applicable: { label: "", chip: "" },
};

export const scoreTone = (s: number) => (s >= 80 ? "text-ok" : s >= 55 ? "text-warn" : "text-bad");
export const scoreStroke = (s: number) => (s >= 80 ? "var(--color-ok)" : s >= 55 ? "var(--color-warn)" : "var(--color-bad)");

export const providerLabel = (p: { name: "claude" | "local" | "custom"; model: string | null }) =>
  p.name === "claude" ? `Claude · ${p.model}` : p.name === "custom" ? `${p.model} · custom API` : "Offline engine";
