# Plumbline × Wispr Flow

Plumbline is designed so that **the whole product can be driven by voice** with [Wispr Flow](https://ref.wisprflow.ai/hhg). Flow types into any text field, so no integration code is required — the product is built around that fact.

## How voice flows through the app

| Moment | What happens | Where |
|---|---|---|
| Open *Dictate today's log* | The entry box is focused automatically — hold your Flow hotkey and talk. | `Composer.tsx` (`autoFocus` + focus on mount) |
| Words arrive | Text that lands in one burst (≥ 14 chars / ≥ 3 words in a single input event) is counted as **dictation**: words spoken, bursts, typing time saved. | `Composer.tsx` `onType` + `inserted()` |
| Floating Flow bar | Always shows the next voice action: *Flow ready*, *Flow heard 24 words ✓*, or the question being asked. | `FlowBar.tsx` |
| Live understanding | After ~650 ms of quiet, the entry is structured and scored; missing evidence becomes questions. | `/api/extract` |
| **Guide me by voice** | Plumbline asks for each missing detail (hours lost, responsible party, trades…), pre-fills the sentence stem ("We lost about …"), focuses the box and optionally reads the question aloud. You answer with the same hotkey; the next question appears when the gap closes. | `Composer.tsx` interview mode |
| Built-in mic (no Flow) | Chrome/Edge speech recognition with voice commands: *scratch that*, *new paragraph*, *next question*, *seal entry*, *start over*. | `useSpeech.ts`, `onFinal` |

## Why this is more than "a textarea"

A dictation tool is only as useful as what happens to the words. The entry is a legal-grade record, so:

1. Dictation is **structured immediately** (crews, equipment, deliveries, inspections, claim events).
2. Every claim event needs **cause, hours, trades, responsible party, corroboration** — missing ones are *asked back*, by voice, in order.
3. Weather claims are **checked against measured data** and the entry is **hash-sealed**.

## Recording tips for the submission video

- Show Wispr Flow's own indicator/hotkey in the frame while you dictate into the entry box.
- Use *Guide me by voice* and answer two questions purely by voice — the evidence ring visibly climbs.
- Finish with the spoken sentence, then press *Seal entry* (or say "seal entry" on the built-in mic).
- Open **Settings → Bring your own key**, paste a key and hit *Test connection* to show the no-code setup.
