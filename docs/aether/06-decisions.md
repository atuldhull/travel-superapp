# 06 — Decisions (locked 2026-05-28)

> The eight Phase-0-blocking questions from [`04-sequencing.md`](04-sequencing.md#decisions) are answered. Phase 0 scaffolding may begin. Any future deviation requires a new ADR + an entry below.

## 1. Aspiration level — **Phase 1 trip-loop (~4 months) as v2 launch**

Atlas + Drift + Pulse + Compass-Bird + Continuum-bar ship as the public v2. Phases 2-4 are post-launch evolution; the team is never carrying two finished frontends.

**Implication:** Lumen / Genie / Vault / Echo / Mirror are deferred past launch. Phase 0 deliverable (Drift prototype) is the v2 reveal sneak-peek.

## 2. Team posture — **Solo founder + composer contract**

Owner: Atul. Audio: 6-month composer engagement (~$40-80k) once Phase 0 validates the language. No engineer hires until Phase 1 metrics justify a Series-A conversation.

**Implication:** Phase 1 timeline = ~6 months (50% solo penalty over the doc's 4-month estimate). Every architectural choice optimizes for "one person can hold the whole graph in their head."

## 3. Brand language — **Warm Italian tactile**

| Token         | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Palette       | terracotta `#C2614A` / ochre `#D9A85C` / olive `#6B7A4F` / cream `#F2E8D5`           |
| Ink           | espresso `#2A1E18` (text on cream) / cream `#F2E8D5` (text on terracotta/olive)      |
| Motion spring | k=120, d=18 — generous settle, soft overshoot                                        |
| Type display  | transitional serif (candidate: Recoleta / GT Sectra / custom commission Phase 6)     |
| Type UI       | tabular sans (candidate: Inter Display / Söhne / Aktiv Grotesk)                      |
| Audio palette | nylon-string + analog tape warmth + soft mandolin confirms; key signature per-region |
| Feel          | "a leather-bound journal in a sunlit piazza"                                         |

**Why this over alternatives:**

- Distinctive in travel-tech (no incumbent ships this aesthetic; Booking is corporate-blue, Airbnb is sans-serif beige, Hopper is gradient-bro).
- Evokes the product directly — travel is sensory, not algorithmic.
- Hardest to copy: terracotta + mandolin + serif is a triple commitment a YC clone won't make.

**Implication:** `@app/aether/motion` tokens go in first; every package downstream consumes them. No raw hex values anywhere in app code — always `motion.color.terracotta`.

## 4. Audio policy — **Mandatory but respects OS mute**

Audio plays by default. Honored:

- `navigator.userActivation.hasBeenActive === false` → audio is queued until first click (browser autoplay policy).
- Device mute / system volume 0 → no audio.
- `prefers-reduced-motion: reduce` → no audio (we treat sound as motion).
- Explicit user opt-out toggle in `/settings/audio` → no audio, persisted in `localStorage` (anonymous) or `User.audioOptOut` (authed).

**Implication:** Audio engine lives in `@app/aether/core` and boots lazily on first interaction. Tone.js + WebAudio + a small <200kb sample library shipped via CDN.

## 5. Premium gating — **all four surfaces gated**

| Surface              | Free                                   | Premium                                                       |
| -------------------- | -------------------------------------- | ------------------------------------------------------------- |
| **Genie**            | text-only Pulse                        | camera + voice + ElevenLabs cloned voice                      |
| **Predictor**        | manual replan only                     | always-on auto-replan + crowd/weather/transport drift signals |
| **Compass Eye AR**   | (deferred Phase 5; both free at first) | Eye mode premium when it ships                                |
| **Lumen PDF export** | browse + edit memory book              | PDF export                                                    |

**Implication:** `@app/aether/core` ships a `usePremium()` hook that reads `User.premiumTier` from the SDK; every gated surface short-circuits to a paywall overlay (the existing Vault surface design).

## 6. Launch order — **Web-first Phase 1-2, mobile Phase 4**

Web v2 (Drift + Atlas + Pulse + Compass-Bird + Continuum-bar) is the public reveal. Mobile parity arrives ~10 months later in Phase 4.

**Implication:** `@app/aether/canvas` web build (R3F + WebGPU) is Priority 1; the mobile build (Skia-based) is deferred until Phase 4. No React-Native dependencies in Phase 0.

## 7. Continuum scope — **Both Apple Continuity + WebTransport with clean fallback**

- **iOS/macOS users:** Apple Continuity APIs (Handoff, Universal Clipboard, Lock Screen Live Activities). Implemented via the existing iOS native module in Phase 3.
- **Everyone else:** WebTransport-based handoff. Self-hosted server on Fly (~$100/mo). QR + push intent.
- **Fallback:** if WebTransport blocked (Safari < 18 / corporate proxies), QR-only.

**Implication:** Phase 1 ships the Continuum-bar with QR + WebTransport. Apple Continuity defers to Phase 3. Bar layout future-proofs the Apple integration.

## 8. AR commitment — **Defer Compass Eye AR to Phase 5**

Compass Bird (top-down map + arrow) covers 90% of users in Phase 1. Compass Eye (AR camera overlay with directional ghost-arrows + place anchors) is Phase 5 work after the mediapipe + gaze stack is already invested for the Predictor.

**Implication:** Phase 0-1 Compass implementation is pure 2D. No camera permissions requested. No mediapipe in the bundle until Phase 5.

---

## Phase 0 — concrete next steps (no further questions)

> **Package naming note:** npm scope names can't contain `/`, so the docs' `@app/aether/<x>` becomes `@app/aether-<x>` in `package.json`. Logical grouping preserved by the shared prefix + a Storybook umbrella later.

1. **`@app/aether-motion`** — Warm Italian tactile tokens (palette / spring / type / audio). Pure tokens, no React. Foundation everything else depends on.
2. **`@app/aether-core`** — runtime contexts: theme provider (loads tokens), audio engine (Tone.js + opt-out honors), perception stub (gaze/gesture detectors return null in Phase 0), `usePremium()`, `useReducedMotion()`.
3. **`@app/aether-canvas`** — R3F + WebGPU wrapper. Falls back to WebGL2 when WebGPU absent. Exports `<AetherScene>` + lighting primitives.
4. **Drift prototype** — `apps/web/src/app/aether/drift/page.tsx`. Hero animation (procedural sun-on-piazza), palette demo, key signature audio loop, ambient particle field (motes of dust catching light). Renders behind a `/aether/drift` route gated by `FEATURE_AETHER_PREVIEW=1`.
5. **Storybook + Chromatic** — `apps/aether-storybook` (new workspace) with the three packages mounted. Chromatic CI on every Aether PR.

**Time budget:** 4-6 weeks at solo-founder pace.

**Exit criteria:** the Drift prototype renders, the audio loop plays on click, the palette derives correctly from the Warm Italian tokens, and a 30-second demo can be screen-recorded and shown to anyone.

## See also

- [`04-sequencing.md`](04-sequencing.md) — the six-phase plan these decisions thread through.
- [`02-surfaces.md`](02-surfaces.md) — what each surface does.
- [`03-tech-stack.md`](03-tech-stack.md) — concrete library list.
