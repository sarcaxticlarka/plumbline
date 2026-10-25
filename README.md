<div align="center">

# Plumbline

**Say what happened. Prove it later.**

Voice-to-evidence for construction. Dictate the day on site; Plumbline structures it, starts your contractual notice clocks, checks weather claims against measured data, and seals everything in a tamper-evident log — so a delay claim never rests on memory.

</div>

---

## The problem

A construction delay claim is only as strong as the record made *that day*. Superintendents write the log at 7 p.m., short, from memory — or reconstruct it weeks later when a dispute starts. Records made at the time carry far more weight than reconstructions, thin documentation is a leading reason claims are rejected, and missing a contractual **notice deadline** can forfeit a valid claim outright. ([sources & caveats](docs/RESEARCH.md))

Existing daily-report apps help you *record* the day. Plumbline is built around what a **claim needs**.

## What it does

| | |
|---|---|
| 🎙️ **Voice-first capture** | Browser speech recognition, or dictate with [Wispr Flow](https://ref.wisprflow.ai/hhg) / phone dictation straight into the box. |
| 🧠 **Structured extraction** | Manpower, equipment, work, deliveries, inspections, safety and every claim-relevant event (delay / change / differing condition / directive / RFI). **Claude** via schema-validated structured outputs, with an **offline rules engine** behind the same contract. |
| ❓ **Evidence meter + "Plumbline asks"** | Each event is scored on cause, quantified hours, affected trades, responsible party, contemporaneous wording and corroboration. Every gap becomes a question you can answer by voice. |
| ⏱️ **Notice clocks** | Per-project notice windows start a countdown for each event, with drafted notice letters, "mark sent", and `.ics` calendar deadlines. |
| 🌦️ **Weather corroboration** | "Rain delay" or "crane down for wind" is checked against measured precipitation / gusts / temperature at the site (Open-Meteo) and sealed with the entry. |
| 🔗 **Tamper-evident log** | SHA-256 hash chain over every entry (transcript, structured data, weather, photo hashes). Edit anything — even directly in SQLite — and verification fails at the first affected entry. |
| 📄 **Claim packet** | Print-ready delay chronology, hours by cause and party, evidence scores, integrity statement. CSV / Markdown exports. |
| 🔑 **Bring your own key** | No code or env vars: paste an Anthropic key — or any OpenAI-compatible API (OpenAI, OpenRouter, Groq, Together, Ollama) — in **Settings**, test it in one click. Stays in your browser; sent only as a header per request. |
| 🗣️ **Built for Wispr Flow** | Focused entry box, dictation-burst detection, a Flow-style bar, and **Guide me by voice**: Plumbline asks each missing detail, you answer with your hotkey. See [Wispr Flow guide](docs/WISPR_FLOW.md). |
| 👥 **Accounts & roles** | Sign-in with per-project roles: **superintendent** (dictate, seal), **PM** (+ send notices, anchor, manage team), **claims reviewer** (read, export, anchor, send), **owner’s rep** (read-only). Non-members can’t even see a project exists. |
| ⚓ **Chain anchoring** | The chain-head fingerprint is **timestamped by an independent RFC 3161 authority** and **emailed to the owner’s rep**. A full-history rewrite (which a hash chain alone can’t catch) is exposed by the mismatch. |
| 🎙️ **Original audio, sealed** | Record the voice alongside the transcript; the file’s SHA-256 is part of the entry’s seal. Plays back with HTTP Range. |
| ✉️ **Email notices + receipts** | Send the drafted notice from the app (SMTP or Resend). The receipt (message-id, server reply, body hash) is stored; with no provider configured it is recorded **but not marked sent**. |
| 📴 **Offline PWA** | Installable. The composer opens with no signal, previews in the browser, queues the entry (photos & audio included) in IndexedDB and seals it once, automatically, when you reconnect — with the capture time kept. |
| 🧾 **Gap detection** | Missing workdays and late (non-contemporaneous) entries are surfaced, not hidden. |

## Quick start

Requires **Node ≥ 22.13** (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev          # http://localhost:3000
```

The first run seeds a demo project with two weeks of logs; wind and rain events are placed on the genuinely windiest and wettest workdays from live weather data. **No API key needed** — the offline engine handles extraction. To use Claude:

```bash
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
```

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Enables Claude extraction (falls back to offline on any failure) |
| `PLUMBLINE_MODEL` | `claude-opus-5-5` | Extraction model |
| `PLUMBLINE_PROVIDER` | – | Set to `local` to force the offline engine |
| `PLUMBLINE_DB` | `./data/plumbline.db` | SQLite file |
| `PLUMBLINE_SEED` | `1` | Seed demo data on first run |
| `PLUMBLINE_DEMO` | on in dev | Shows *Simulate tampering* / *Reset demo data* (never enable in production) |

```bash
npm test             # 39 tests: domain logic, extractor, SQLite integration
npm run typecheck
npm run build && npm start

# Real-Chrome end-to-end tests (need Google Chrome + a production server on :3100 with PLUMBLINE_DEMO=1)
npm run e2e:offline  # service worker, go offline, queue, reconnect, exactly-once seal
npm run e2e:audio    # sign-in UI, fake microphone, sealed + playable audio
```

## Demo accounts

With `PLUMBLINE_DEMO=1` (default in dev) the login page has one-click roles on a seeded project: **Maya Chen** (superintendent), **Dev Patel** (PM), **Priya Nair** (claims reviewer), **Jordan Reyes** (owner’s rep). Shared demo password `plumbline-demo`. Real deployments: leave demo mode off and use *Create account*; a PM invites people by email from the **Team** tab.

## Try this

0. Landing → **Open the live demo** → pick *Dev Patel (PM)*. On the project, click **Anchor now** (a real RFC 3161 timestamp), then **Rewrite whole chain**: the chain still says verified, the anchor shouts *mismatch*.
1. Landing page → edit one word in the live chain playground.
2. **Open the live demo → Dictate today's log →** click *Wind day* (or dictate your own). Watch the evidence ring, the gap questions and the notice clock appear. Answer a gap by voice.
3. **Seal entry**, then **Notices → Draft notice**.
4. On the project header, click **Simulate tampering**, then open **Claim packet**.

## Under the hood

Pure, unit-tested domain logic (`src/lib/domain`) · one zod extraction contract shared by Claude and the offline engine · verbatim-quote guard against hallucinated evidence · `node:sqlite` with versioned migrations · Next.js 16 / React 19 / Tailwind 4 / Motion / Lenis.

Design: hi-vis lime on black, condensed signage type, hazard tape and a plumb-line canvas — see [Design language](docs/DESIGN.md).

Read more: [Wispr Flow guide](docs/WISPR_FLOW.md) · [Research](docs/RESEARCH.md) · [Product brief](docs/PRODUCT.md) · [Architecture & threat model](docs/ARCHITECTURE.md) · [Demo script](docs/DEMO_SCRIPT.md)

## Honest limitations

- **Not legal advice.** Notice-period presets are illustrative; users must set windows from their own contract.
- **Tamper-*evident*, not tamper-proof.** Someone with write access to the whole database could recompute the chain. External anchoring (RFC 3161 timestamps, emailed chain heads) is the planned fix — see the threat model.
- **Bring-your-own-key** sends the key to the server per request (never stored or logged). On a hosted deployment that means trusting the host; for sensitive projects self-host. Private/internal API URLs are blocked in production (SSRF guard); local models need a self-hosted Plumbline.
- Accounts are email + password only: no email verification, password reset, SSO or MFA yet, and org-level tenancy is project-membership based.
- **Timestamps:** the app checks that the TSA granted the request and echoed our digest, and stores the `.tsr`; it does not itself validate the TSA’s signature chain — verify with `openssl ts -verify` (command shown in the UI).
- **Offline:** the service worker only runs in production builds; a page must have been opened once online to be available offline; the capture time comes from the phone’s clock (shown as device-reported); dates use the server’s time zone (no per-project time zone yet).
- **Email:** delivery *receipts* are SMTP acceptance (plus Resend webhooks if configured); true inbox delivery can’t be proven by any sender.
- The embedded browser pane of some tools blocks service workers; test PWA behaviour in Chrome.
- The offline extractor covers common site phrasing; Claude handles the long tail.

## License

MIT
