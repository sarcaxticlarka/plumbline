# Market research & idea selection

*Compiled 25 Oct 2026 from web searches. Many sources are vendor-authored; they are flagged below and the numbers should be read as directional, not audited.*

## The brief

Build something that is (a) built around voice dictation (Wispr Flow-style tools type into any text field), (b) solves a real, expensive problem, and (c) is deep enough to be a product rather than a demo.

## What Wispr-style dictation is used for today

- Mostly email, meeting notes, long-form drafting and developer prompts. Cloud-based, cleans filler words, formats by app. Reviews note privacy as the main caveat; HIPAA/SOC 2 claims come from a third-party review.
  - [The Neuron review](https://www.theneuron.ai/tools/wispr-flow/review/) · [Sacra](https://sacra.com/c/wispr) · [Wispr blog](https://wisprflow.ai/post/wispr-flow-for-seamless-communication)
- **Takeaway:** dictation tools are horizontal. The opportunity is a *vertical* product where speaking is the natural input and where the output has legal or financial value — not another note-taker.

## Candidate verticals considered

| Vertical | Pain | Verdict |
|---|---|---|
| Clinical documentation (ambient scribes) | Large, real | **Crowded and heavily funded** — Abridge ($300M Series E, Jun 2025), Enzo Health ($20M, May 2026), Kin Health ($8.2M). Regulated; hard to differentiate in a demo. [Funding roundup](https://aiweekly.co/alerts/elevenlabs-anchors-7bn-voice-ai-funding-rush-in-q1-2026) |
| Generic meeting → tasks | Real | Commodity; every note-taker does it. |
| **Construction daily reports & delay evidence** | Daily logs are legal records; written late and from memory | **Chosen.** Voice is the natural input (hands full, on a slab), the output has direct dollar value (claims), and the existing tools stop at "log the day". |

## Why construction daily logs

1. **They are the contemporaneous record.** Courts and adjudicators generally give more weight to records made at the time than to reconstructions from memory. ([Shape Construction](https://www.shape.construction/templates/daily-report) — vendor)
2. **Thin records sink valid claims.** Unsubstantiated time-and-disruption claims, lacking evidence of cause, are commonly rejected ([HKA](https://www.hka.com/article/project-records-from-a-delay-analysis-perspective/)); with weak documentation the dispute shifts to defending the adequacy of the records themselves ([American Bar Association](https://www.americanbar.org/groups/litigation/resources/newsletters/insurance-coverage/when-the-schedule-isnt-evidence-builders-delay-claims/)).
3. **Writing them is a tax.** One vendor estimates 30–60 minutes a day on a busy site, plus 15–25 minutes of re-entry per report ([ImageToTable](https://imagetotable.ai/blog/manual-site-report-data-entry-cost-construction), [Dan Cumberland Labs](https://dancumberlandlabs.com/blog/duties-of-a-construction-superintendent/) — both vendor estimates). Which is why logs are late, short and from memory.
4. **Contracts impose notice deadlines.** Missing a contractual notice window can forfeit a claim regardless of its merit. Windows differ per contract (the product makes them configurable and says so loudly).
5. **Market:** construction software is estimated at roughly $5–11.6B in 2026 depending on the research firm and scope (Mordor, Straits, TBRC, FMI) — wide disagreement, so treat as order-of-magnitude. [Straits Research](https://straitsresearch.com/report/construction-software-market)

## Competitive landscape (category level)

| Player | What it does | Gap Plumbline targets |
|---|---|---|
| Raken | Mobile daily reports; voice-to-text capture ("under five minutes"). One comparison notes it doesn't preserve original voice audio or hash submissions. | Capture-first; no claim workflow. |
| Procore (AI Daily Log Agent, add-on) | Enterprise platform; AI draft of daily logs. | Heavy, enterprise-priced; logging, not claim-readiness. |
| Hardline, FieldSift | Turn calls/texts into Procore log drafts. | Ingestion layer, not evidence layer. |
| BuildLog | Markets offline-first, tamper-evident logs. | Closest on integrity; no notice clocks / gap questions / weather corroboration (per its public comparison page). |
| ProStroyka | Voice-first daily reports (~$49–99/user/mo, vendor-stated). | Capture-first. |
| Buildertrend, CompanyCam | Client updates and photo-based summaries. | Different job. |

Sources (all vendor roundups, so claims vary): [Workyard](https://www.workyard.com/compare/contractor-apps), [Contractor Tool Stack on Raken](https://contractortoolstack.com/software/raken/), [BuildLog comparison](https://buildlogapp.com/blog/best-construction-daily-report-software-2026.html), [ProStroyka comparison](https://prostroyka.com/en/blog/best-construction-daily-report-apps), [Dan Cumberland Labs](https://dancumberlandlabs.com/blog/construction-field-report-software/).

**Positioning:** everyone helps you *record* the day. Nobody (in what I found) owns *what a claim needs*: the question you should have answered, the notice you must send by a date, the weather that backs you up, and a record nobody can quietly edit.

## What this research does *not* establish

- No independent figure for the share of claim cost attributable to documentation gaps (searched; not found).
- No superintendent adoption survey for voice tools.
- Pricing figures for competitors conflict between sources.
- Nothing here is legal advice; notice-period presets in the product are illustrative.
