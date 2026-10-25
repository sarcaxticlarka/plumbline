# Design language — "Hi-vis on black"

The product is for people in hard hats, so the interface borrows from the job site instead of from SaaS templates.

| Decision | Choice | Why |
|---|---|---|
| Ground | Near-black `#0a0a09`, with bone-paper (`.theme-paper`) for documents and one light section | A night-shift site office; bone paper reads as "the record" and prints correctly. |
| Accent | Safety-vest lime `#d2ff1e`, used sparingly and always with black text | The colour of hi-vis gear. One loud colour instead of a gradient palette. |
| Display type | **Archivo** (variable, width axis 62–125) in tall, condensed caps | Reads like site signage; one family gives condensed headlines and wide wordmarks. |
| Body / UI | **Geist** + **Geist Mono** for labels, hashes, buttons | Quiet grotesk next to loud signage; mono for anything that is "data". |
| Shapes | Hairlines, 2–4px radii, no drop shadows | Drawing-sheet rigour; depth comes from borders and contrast, not blur. |
| Motifs | Hazard-tape marquee, 80px drawing grid, crosshairs, plumb-line canvas, big tabular numerals | One idea (the plumb line) carried from logo → hero → ledger. |
| Motion | Lenis smooth scroll, scroll-lit paragraph, pinned 4-step story, horizontal ledger with a live SHA-256 tamper, magnetic-style cursor, text-roll buttons, line-mask headline reveals, preloader | Scroll is the narrative; every animation demonstrates something the product does. |

## Where each idea comes from

- **Plumb-line curtain** (`PlumbCurtain.tsx`): ~110 hairline pendulums with a travelling "voice" wave; bobs lean toward the pointer.
- **Scroll-lit statement** (`Statement.tsx`): the problem as one paragraph whose words ignite with scroll progress.
- **Pinned story** (`Story.tsx`): sticky 420vh section; scroll progress drives typing, extraction, the evidence ring and the seal.
- **Ledger** (`Ledger.tsx`): horizontal scroll through nine chained entries; at the midpoint entry #5 is "fixed" and every later seal turns red, using real WebCrypto SHA-256.
- **App**: the same tokens re-skin every screen. Documents (the claim packet) flip to bone paper via CSS variables only, so print output stays clean.

## Accessibility & performance notes

- `prefers-reduced-motion` disables Lenis, the preloader and the canvas animation (draws one static frame).
- The custom cursor only mounts for `(hover: hover) and (pointer: fine)`.
- Canvas pauses off-screen (IntersectionObserver); nav and scroll handlers are passive.
- Colour pairs: bone-on-black ≈ 15:1; black-on-lime ≈ 17:1; muted text is used only for secondary labels.
