# Architecture

```
                   ┌──────────────────────────── browser ────────────────────────────┐
 mic / Wispr Flow  │  Composer (React)      Notice board     Packet / Logbook (RSC)   │
 ───────────────▶  │  live preview ──┐                                                │
                   └─────────────────┼────────────────────────────────────────────────┘
                                     ▼  POST /api/extract (debounced, stateless)
┌──────────────────────────── Next.js route handlers (Node) ───────────────────────────┐
│  zod validation · rate limit · error mapping                                          │
│                                                                                       │
│  services.ts ── previewExtraction / sealLog / overview / portfolio                    │
│        │                                                                              │
│        ├─ ai/index.ts ── Claude (messages.parse + zod)  ──fallback──▶ ai/local.ts     │
│        │         └─ enforceVerbatimQuotes (anti-hallucination)                         │
│        ├─ weather/ ── Open-Meteo → thresholds.ts (pure judgement)                     │
│        └─ domain/  ── evidence · notice · chain · letter · export   (pure, tested)    │
│                                                                                       │
│  db/repo.ts ── node:sqlite  (projects · log_entries[hash-chained] · notices · uploads)│
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## Folder structure

```
src/
  app/
    (marketing)/page.tsx        landing page
    app/                        authenticated-style product shell
      page.tsx                  site control dashboard
      projects/new              project setup (geocoding + notice presets)
      projects/[id]/            layout (header, chain badge, tabs)
        page.tsx                logbook
        new/                    voice composer
        logs/[logId]/           entry detail + seal proof
        notices/                notice clock board + letter drafting
        packet/                 printable claim packet
    api/                        route handlers (extract, projects, logs, events, uploads, export, demo, geocode)
  components/
    landing/ app/ composer/ ui/
  lib/
    domain/                     PURE business logic — no I/O, fully unit-tested
      schema.ts types.ts        the extraction contract + API payloads (zod)
      evidence.ts               scoring + gap questions
      notice.ts dates.ts        notice windows, clocks, date-only arithmetic
      chain.ts                  canonical JSON + SHA-256 hash chain
      events.ts letter.ts export.ts
    ai/                         extractors (Claude + offline) behind one interface
    weather/                    Open-Meteo client + threshold judgement
    db/                         sqlite client/migrations, repository, demo seed
    services.ts                 orchestration used by routes and pages
tests/                          vitest: domain, extractor, SQLite integration
docs/                           research, product brief, this file, demo script
```

## Key decisions

1. **One extraction contract, two engines.** `ExtractionSchema` (zod) is used as the Claude structured-output schema *and* as the contract the offline rules engine must satisfy (tested). Everything downstream is provider-agnostic, so the product works with no API key, no network and no data leaving the machine — and falls back automatically if Claude errors, times out or refuses.
2. **Claude via `messages.parse` + `zodOutputFormat`.** Schema-valid output without forced tool use (which current models reject). Model defaults to `claude-opus-5-5`, overridable with `PLUMBLINE_MODEL`. Effort is `low` — it's extraction, not reasoning.
3. **Never trust a quote the model can't source.** Every event carries a verbatim `quote`. `enforceVerbatimQuotes` drops any quote that isn't in the transcript (normalised for case/punctuation) and clamps absurd numbers. A paraphrase would *look* like evidence; dropping it lowers the evidence score instead.
4. **Evidence is derived, not stored.** Scores, gaps, weather verdicts and notice dates are recomputed from the sealed content on every read. Only user workflow state (notice sent / waived) lives outside the seal.
5. **Prompt-injection posture.** The transcript is untrusted: it's wrapped in `<transcript>` tags and the system prompt instructs the model to treat it as data. The model has no tools, no network and no write access; the worst case is a bad extraction, which the verbatim-quote guard and visible human review (the user sees the preview before sealing) contain.
6. **Dates are date-only strings in UTC arithmetic.** Notice math is timezone-stable and unit-testable.
7. **`node:sqlite`.** Zero native dependencies, one file, WAL mode, versioned migrations (`PRAGMA user_version`). Swap for Postgres behind `db/repo.ts` when multi-tenant.

## The hash chain — and an honest threat model

`hash(n) = SHA-256( seq | projectId | createdAt | hash(n−1) | canonicalJSON(content) )`; `content` includes transcript, structured data, weather snapshot, provider and attachment hashes.

**What it proves:** the record is internally consistent. Editing, deleting, inserting or reordering any earlier entry — through the app or directly in the database — breaks verification at the first affected entry (demonstrated by `Simulate tampering`, and by `tests/repo.test.ts`).

**What it does not prove on its own:** that a *privileged operator who can rewrite the whole chain* didn't. Anyone with database write access can recompute every hash. Real tamper-*resistance* needs the chain head anchored outside the operator's control. Planned: daily RFC 3161 trusted timestamps of the head hash, and emailing the head to the client/owner's rep. Until then the claim is *tamper-evident to anyone holding a previously published head*, not tamper-proof. The UI says "verified", never "immutable".

Also out of scope for v0.1: authentication, per-tenant isolation, audit logging of reads, encryption at rest.

## Failure modes handled

| Failure | Behaviour |
|---|---|
| No API key / Claude timeout / refusal / schema mismatch | Offline engine used; UI shows a note. |
| Weather API down | Verdict `unavailable`; never blocks sealing. |
| Microphone blocked / unsupported browser | Clear message; typing and external dictation still work. |
| Duplicate photo upload | Content-addressed by SHA-256; stored once. |
| Concurrent seals | `BEGIN IMMEDIATE` transaction computes `seq`/`prevHash` atomically. |
| Rapid typing | Debounced preview; stale requests aborted; server rate-limited per IP. |

## Bring-your-own-key (BYOK)

- **Client:** `lib/ai/client-config.ts` keeps `{provider, apiKey, model, baseUrl}` in `localStorage` ("remember") or `sessionStorage`, and adds `x-plumbline-*` headers to `/api/extract` and the seal route.
- **Server:** `lib/ai/config.ts` strictly validates the headers (anything malformed is ignored, never half-trusted). `extract()` prefers the visitor's credentials, then the server env key, then the offline engine. Claude goes through the official SDK with a per-request client; other providers use `openai-compat.ts` and are validated against the same zod contract (with repair for omitted fields).
- **Never stored:** keys are not persisted, logged or echoed; `/api/ai/test` returns only latency, model and counts.
- **SSRF:** `safe-url.ts` rejects non-https, credentials-in-URL and private/loopback/link-local/metadata addresses in production (set `PLUMBLINE_ALLOW_PRIVATE_URLS=1` when self-hosting a local model). Known limit: DNS is resolved at check time, so a rebinding attack between check and fetch isn't fully closed; redirects are refused.
- **Trade-off:** the key transits the server. A browser-direct mode would keep it off our infrastructure but conflicts with server-side re-extraction at seal time; self-hosting is the recommended path for sensitive projects.
