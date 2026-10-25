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

## Accounts, roles and access control

- `lib/auth/permissions.ts` is a pure action→role matrix shared by the server guards and the UI (which hides what a role can't do).
- Sessions: a random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production); only its SHA-256 is stored. Passwords use **scrypt** (Node core) with a per-user salt; login burns equal time for unknown emails and is rate-limited.
- Every route handler goes through `apiUser` / `apiProject(req, projectId, action)`: 401 signed-out, **404 for non-members** (existence isn't leaked), 403 when the role lacks the action. Mutating requests also check that `Origin` matches the host (CSRF defence in depth). Pages use `pageUser` / `pageProject`.
- Invites for people who haven't signed up yet are stored by email and become memberships on sign-up/sign-in.

## External anchoring

`anchorProject()` refuses to anchor a record that already fails verification, then (a) asks a public TSA for an **RFC 3161** timestamp of `SHA-256("plumbline-chain-head:v1:<project>:<seq>:<hash>")` (hand-rolled DER in `anchor/der.ts`, verified against freeTSA and OpenSSL) and (b) emails the fingerprint to the owner's rep. `integrity()` re-checks every anchor against the live chain, so an attacker who edits an entry *and recomputes every later hash* still fails: the timestamped/emailed hash for that sequence number no longer matches. Emails that were never delivered (no provider) are explicitly **not** counted as anchors. `/api/cron/anchor` anchors every project on a schedule.

## Original audio

`useRecorder` runs `MediaRecorder` next to speech recognition (and independently, so it also works while dictating with Wispr Flow). The file is uploaded content-addressed by SHA-256, listed in the entry's `attachments`, and therefore inside the hash seal. `/api/uploads/[sha]` requires sign-in and supports HTTP Range.

## Email notices

`lib/email` has three modes: SMTP (nodemailer), Resend (HTTP), or **preview** — recorded, not delivered, notice **not** marked sent. Each send stores a receipt (provider, message-id, server reply, body SHA-256). Resend webhooks (`/api/webhooks/email?token=…`) upgrade a receipt to *delivered* or *bounced*.

## Offline mode

- `public/sw.js` — cache-first for static assets, network-first with cached fallback for `/app/*` pages, never caches `/api/*`; on sign-out the page tells the worker to forget cached authenticated pages.
- `lib/offline/outbox.ts` — IndexedDB outbox (entry JSON + photo/audio Blobs). `SyncBanner` flushes automatically on reconnect and on a timer.
- **Exactly-once:** each entry carries a client-generated `clientId`; `insertLog` checks it inside the same SQLite transaction that inserts, so two racing syncs (e.g. two tabs, or an old page and a reloaded one) produce one sealed entry. Found by the real-Chrome e2e test, fixed and unit-tested.
- Offline preview runs the same pure rules engine and evidence scorer in the browser; weather resumes on reconnect.
- `capturedAt` (device clock, sanity-checked: not future, not >30 days old) is stored in the seal and used for the "same-day" evidence check, and is displayed as device-reported.
