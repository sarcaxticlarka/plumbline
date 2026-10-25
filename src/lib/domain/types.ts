import type { Extraction, EventKindT, CauseT, PartyT } from "./schema";

export interface NoticeRules {
  preset: string;
  delayNoticeDays: number;
  changeNoticeDays: number;
  differingConditionNoticeDays: number;
}

/**
 * Illustrative presets only. Contract notice periods differ by contract, amendment and
 * jurisdiction; users must confirm against their own documents.
 */
export const RULE_PRESETS: Record<string, { label: string; rules: NoticeRules }> = {
  standard21: {
    label: "Standard — 21 day claims window",
    rules: { preset: "standard21", delayNoticeDays: 21, changeNoticeDays: 21, differingConditionNoticeDays: 14 },
  },
  tight7: {
    label: "Tight — 7 day written notice",
    rules: { preset: "tight7", delayNoticeDays: 7, changeNoticeDays: 7, differingConditionNoticeDays: 7 },
  },
  publicWorks10: {
    label: "Public works — 10 day notice",
    rules: { preset: "publicWorks10", delayNoticeDays: 10, changeNoticeDays: 10, differingConditionNoticeDays: 5 },
  },
};

export interface Project {
  id: string;
  name: string;
  address: string;
  client: string;
  contractor: string;
  contractRef: string;
  ownerName: string;
  ownerEmail: string;
  lat: number | null;
  lon: number | null;
  rules: NoticeRules;
  createdAt: string;
}

export interface Attachment {
  sha256: string;
  name: string;
  size: number;
  mime: string;
}

export type WeatherVerdict = "corroborated" | "not_supported" | "unavailable" | "not_applicable";

export interface WeatherEvidence {
  source: "open-meteo";
  fetchedAt: string;
  date: string;
  lat: number;
  lon: number;
  precipitationMm: number | null;
  windMaxKmh: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
}

/** Everything inside the tamper-evident seal. */
export interface SealedContent {
  logDate: string;
  author: string;
  source: "voice" | "text";
  transcript: string;
  structured: Extraction;
  attachments: Attachment[];
  weather: WeatherEvidence | null;
  provider: { name: "claude" | "local" | "custom"; model: string | null };
  addendumOf: string | null;
  /** Who recorded it (account id) — absent on entries made before accounts existed. */
  authorId?: string;
  /** Device-reported time the entry was dictated, when it was sealed later (offline queue). Untrusted clock, shown as such. */
  capturedAt?: string;
  clientId?: string;
}

export interface LogEntry {
  id: string;
  projectId: string;
  seq: number;
  createdAt: string;
  prevHash: string;
  hash: string;
  content: SealedContent;
  score: number;
}

export type NoticeStatus = "open" | "sent" | "waived";

export interface EventRecord {
  id: string;
  projectId: string;
  logId: string;
  logSeq: number;
  index: number;
  kind: EventKindT;
  title: string;
  description: string;
  cause: CauseT;
  hoursLost: number | null;
  tradesAffected: string[];
  responsibleParty: PartyT;
  criticalPathLikely: boolean;
  quote: string;
  occurredOn: string;
  noticeDueOn: string | null;
  noticeStatus: NoticeStatus;
  noticeSentOn: string | null;
  evidenceScore: number;
  weatherVerdict: WeatherVerdict;
}

export type Severity = "high" | "medium" | "low";

export interface Gap {
  scope: "event" | "entry";
  eventIndex?: number;
  key: string;
  severity: Severity;
  question: string;
}

export interface EvidenceCheck {
  key: string;
  label: string;
  ok: boolean;
  weight: number;
  hint: string;
}

export interface ChainResult {
  ok: boolean;
  checked: number;
  headHash: string;
  brokenAtSeq?: number;
  reason?: string;
}

export type NoticeState = "sent" | "waived" | "overdue" | "due_today" | "critical" | "soon" | "open";
