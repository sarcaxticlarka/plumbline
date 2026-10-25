# Product brief — Plumbline

> **Say what happened. Prove it later.**

## Who it's for

**Primary:** site superintendents and project engineers at mid-size general and specialty contractors (20–500 employees) who sign daily reports and are on the hook when a delay turns into a dispute.
**Economic buyer:** the project executive / VP operations / claims manager — the person who pays when a claim is lost on documentation.

## The job

"When something goes wrong on site, make sure I have the record, the notice, and the evidence — without adding an hour to my day."

## Why now

- Dictation and structured LLM extraction are finally good enough to turn rambling speech into reliable fields.
- Contractors already use voice-to-text for logs; the upgrade path to *evidence* is untapped.
- Supply of claims-adjacent skills is thin on site; software that asks the right question at the right moment is leverage.

## The wedge and the moat

| Layer | Wedge feature | Why it compounds |
|---|---|---|
| Capture | Voice → structured log | Table stakes (everyone has it). |
| **Evidence** | Per-event scoring + "Plumbline asks" gap questions | Behavioural: trains crews to give claim-grade detail. |
| **Notice** | Contract notice clocks, drafted letters, calendar export | Directly prevents the most expensive failure. |
| **Corroboration** | Weather claims checked against measured data; photo SHA-256 sealed | Third-party facts raise the weight of the record. |
| **Integrity** | Hash-chained log, verifiable by anyone | Trust asset; later, external anchoring. |
| Data | Cross-project delay & cause database | Benchmarks, predictive risk, insurer/surety partnerships. |

## Business model hypothesis (to validate, not asserted)

- Per-project subscription (not per-seat), tiered by project size, with unlimited superintendent seats — aligns price with claim exposure, not headcount.
- Add-ons: claims-consultant export, surety/insurer reporting, SSO/audit retention.
- Pilot design: 3 mid-size GCs, 1 active project each, success = (a) ≥90% of workdays logged same-day, (b) zero missed notice windows, (c) one claim packet assembled in < 1 hour vs. the current manual effort.

## What exists in this repo (v0.1)

- Voice/dictation composer with live structured extraction and evidence meter.
- Claude structured-output extractor + offline rules engine behind one schema.
- Notice clocks with drafted letters, `.ics` deadlines, delay register CSV.
- Weather corroboration (Open-Meteo), photo hashing, missing-day detection.
- SHA-256 hash chain, verification UI, tamper simulation.
- Printable claim packet.

## Roadmap

1. **Auth, orgs, roles** (superintendent, PM, claims reviewer, read-only owner rep). Row-level isolation in Postgres.
2. **External anchoring** — daily chain-head → RFC 3161 timestamp authority (and/or public anchoring) so even a database admin can't rewrite history.
3. **Original audio retention** with the transcript, hash-sealed.
4. **Schedule linkage** — import P6/MS Project; map events to activities; show critical-path impact.
5. **Offline-first PWA** for dead zones, with queued sync.
6. **Contract ingestion** — read the notice clauses from the contract PDF and set the clocks automatically (with human confirmation).
7. **Integrations** — Procore / Autodesk Build push of daily logs, email send with delivery receipts.
8. **Cross-project analytics** for claims managers.

## Risks

- *Legal reliance:* evidence scores are decision aids; all UI states notice windows must be verified. Needs counsel review before commercial launch.
- *Trust:* "tamper-evident" must not be oversold — see the threat model in `ARCHITECTURE.md`.
- *Adoption:* superintendents are time-poor; the product must be faster than paper. Mitigated by voice-first capture and by asking questions only when they matter.
