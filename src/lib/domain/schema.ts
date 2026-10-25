import { z } from "zod";

/**
 * The extraction contract. Both extractors (Claude via structured outputs and the
 * offline rule-based engine) must produce exactly this shape, so everything
 * downstream (evidence scoring, notice clocks, chain, exports) is provider-agnostic.
 *
 * Note: kept to plain object/array/enum/nullable constructs so it is compatible
 * with the Messages API structured-output JSON-schema subset.
 */

export const EVENT_KINDS = [
  "delay",
  "change",
  "differing_condition",
  "owner_direction",
  "rfi",
] as const;

export const CAUSES = [
  "weather",
  "design",
  "owner",
  "inspection",
  "material",
  "utility",
  "subcontractor",
  "differing_condition",
  "scope_change",
  "access",
  "equipment",
  "other",
] as const;

export const PARTIES = [
  "owner",
  "architect",
  "gc",
  "subcontractor",
  "supplier",
  "utility",
  "authority",
  "weather",
  "unknown",
] as const;

export const EventKind = z.enum(EVENT_KINDS);
export const Cause = z.enum(CAUSES);
export const Party = z.enum(PARTIES);

export const ExtractedEventSchema = z.object({
  kind: EventKind.describe("What type of claim-relevant event this is"),
  title: z.string().describe("Short headline, e.g. 'Crane stood down for wind'"),
  description: z.string().describe("One or two factual sentences. No speculation."),
  cause: Cause,
  hoursLost: z.number().nullable().describe("Crew/work hours lost if stated, otherwise null"),
  tradesAffected: z.array(z.string()).describe("Trades or activities impacted"),
  responsibleParty: Party.describe("Who the speaker attributes the cause to; unknown if not stated"),
  criticalPathLikely: z
    .boolean()
    .describe("True only if the speaker implies the work gates other work or the schedule"),
  quote: z.string().describe("The shortest verbatim phrase from the transcript that supports this event"),
});

export const ExtractionSchema = z.object({
  summary: z.string().describe("Two-sentence neutral summary of the day"),
  weather: z.object({
    conditions: z.string().nullable(),
    highTempF: z.number().nullable(),
    precipitationMentioned: z.boolean(),
    windMentioned: z.boolean(),
  }),
  manpower: z.array(
    z.object({
      trade: z.string(),
      headcount: z.number(),
      hours: z.number().nullable(),
      company: z.string().nullable(),
    }),
  ),
  equipment: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      status: z.enum(["active", "idle", "down"]),
    }),
  ),
  work: z.array(
    z.object({
      area: z.string().nullable(),
      activity: z.string(),
    }),
  ),
  deliveries: z.array(
    z.object({
      item: z.string(),
      supplier: z.string().nullable(),
      status: z.enum(["received", "late", "rejected", "expected"]),
    }),
  ),
  inspections: z.array(
    z.object({
      type: z.string(),
      result: z.enum(["passed", "failed", "pending", "cancelled"]),
      inspector: z.string().nullable(),
    }),
  ),
  safety: z.array(
    z.object({
      kind: z.enum(["observation", "near_miss", "incident", "toolbox_talk"]),
      description: z.string(),
      injury: z.boolean(),
    }),
  ),
  visitors: z.array(z.string()),
  events: z.array(ExtractedEventSchema),
  openItems: z.array(z.string()).describe("Follow-ups the speaker said they still need to do"),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;
export type EventKindT = z.infer<typeof EventKind>;
export type CauseT = z.infer<typeof Cause>;
export type PartyT = z.infer<typeof Party>;

export const emptyExtraction = (): Extraction => ({
  summary: "",
  weather: { conditions: null, highTempF: null, precipitationMentioned: false, windMentioned: false },
  manpower: [],
  equipment: [],
  work: [],
  deliveries: [],
  inspections: [],
  safety: [],
  visitors: [],
  events: [],
  openItems: [],
});

/* ---------- API payloads ---------- */

export const NoticeRulesSchema = z.object({
  preset: z.string(),
  delayNoticeDays: z.number().int().min(1).max(90),
  changeNoticeDays: z.number().int().min(1).max(90),
  differingConditionNoticeDays: z.number().int().min(1).max(90),
});

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).default(""),
  client: z.string().trim().max(120).default(""),
  contractor: z.string().trim().max(120).default(""),
  contractRef: z.string().trim().max(120).default(""),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lon: z.number().min(-180).max(180).nullable().default(null),
  rules: NoticeRulesSchema,
});

export const AttachmentSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().max(200),
  size: z.number().int().nonnegative(),
  mime: z.string().max(80),
});

export const CreateLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().trim().min(1).max(80),
  transcript: z.string().trim().min(20, "Say a little more — at least a couple of sentences.").max(20000),
  source: z.enum(["voice", "text"]).default("text"),
  attachments: z.array(AttachmentSchema).max(24).default([]),
  addendumOf: z.string().nullable().default(null),
});

export const ExtractRequestSchema = z.object({
  transcript: z.string().max(20000),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  photos: z.number().int().min(0).max(50).default(0),
});

export const PatchEventSchema = z.object({
  noticeStatus: z.enum(["open", "sent", "waived"]),
  noticeSentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
