# `apps/mobile/src/aether/` — Aether mobile surface components

> Phase 4 (mobile parity) lives here. Every Aether mobile surface
> component lands under this folder, gated by
> `EXPO_PUBLIC_FEATURE_AETHER_PHASE1`. The 1.0 routes in
> [`apps/mobile/app/`](../../app/) are scaffolding marked for
> retirement once each surface ports.

## What's here today

- `pulse-glow.tsx` (AE526) — first Aether mobile surface. 64-px
  Skia corner glow with the canonical breathing envelope driven by
  the same `pulseBreathAt(mood, t)` helper the web R3F Pulse uses
  (in `@app/aether-canvas-shared`). Mounted in
  [`app/_layout.tsx`](../../app/_layout.tsx) above the Stack so it
  persists across navigation.

## Architecture summary (per `docs/aether/15-phase4-plan.md`)

- **Renderer policy** (locked Phase 4 decision #2): R3F-native (via
  `expo-three` + `@react-three/fiber/native`) for surfaces with
  depth; Skia (via `@shopify/react-native-skia`) for flat surfaces.
  The frozen table lives in
  `@app/aether-canvas-native/src/renderer-policy.ts`:
  - **Skia**: Pulse, Mirror, Continuum
  - **R3F-native**: Drift, Atlas, Lumen, Compass, Vault, Echo, Genie
- **Pure math** is consumed verbatim from
  `@app/aether-canvas-shared`. Web R3F + mobile R3F-native + mobile
  Skia all use the same lifecycle progress, camera poses, pulse
  breathing, glyph positions, etc. The canvas-shared invariants spec
  ([AE489](../../../../packages/aether-canvas-shared/test/invariants.spec.ts))
  pins the bounds for every consumer.
- **Audio** (Tone.js → expo-av) is scaffolded in
  `@app/aether-audio-native` with a `NativeAudioEngine` adapter
  contract. Real expo-av wiring lands when Genie mobile ports.

## Surface port order

Per `docs/aether/15-phase4-plan.md` table, ordered by
user-impact / dependency-depth:

| Order | Surface   | Renderer | Status             | Interaction                                |
| ----- | --------- | -------- | ------------------ | ------------------------------------------ |
| 1     | Pulse     | Skia     | ✅ AE526 (overlay) | ambient (breathing glow)                   |
| 2     | Drift     | R3F      | ✅ AE534-537       | ambient (sun + field)                      |
| 3     | Atlas     | R3F      | ✅ AE539-540       | tap orb → place card (`useR3FSelection`)   |
| 4     | Compass   | R3F      | ✅ AE543-544       | real device heading (expo-location)        |
| 5     | Continuum | Skia     | ✅ AE531 + AE541   | ambient (sigil)                            |
| 6     | Lumen     | R3F      | ✅ AE549-550       | tap plane → photo card (`useR3FSelection`) |
| 7     | Genie     | R3F      | ✅ AE554-555       | tap → listening FSM                        |
| 8     | Vault     | R3F      | ✅ AE545-546       | tap glyph → checkout (`useR3FSelection`)   |
| 9     | Echo      | R3F      | ✅ AE551-552       | swipe → next memory (PanGesture)           |
| 10    | Mirror    | Skia     | ✅ AE556-557       | tap row → expand detail (AE578)            |

**✅ Phase 4 CODE-COMPLETE (Round BF, AE582).** All ten surfaces
scaffolded (Round AZ); 7/7 non-trivial surfaces interact (Round BE —
Mirror's tap-to-expand closed the last gap). The three ambient surfaces
(Pulse / Drift / Continuum) are decorative by design on web too. The R3F
tap-scenes (Atlas / Lumen / Vault) share one `useR3FSelection<T>` hook
(`apps/mobile/lib/use-r3f-selection.ts`, AE579). Remaining work is
backend b-slices (STT / camera / WebTransport / admin stream) + the EAS
device build that turns "typechecks" into "runs" — the full inventory +
operator handoff is in
[`docs/aether/38-phase4-closeout.md`](../../../../docs/aether/38-phase4-closeout.md).

## Wiring conventions

- **Always import math from `@app/aether-canvas-shared`** — never
  re-derive a lifecycle / palette / particle helper locally. AE489's
  invariants spec is the contract.
- **Skia components** mount as absolutely-positioned `<View>`
  wrappers around `<Canvas>`. Use `pointerEvents='none'` when the
  surface is a decorative overlay.
- **R3F-native components** mount inside `<Canvas>` from
  `@react-three/fiber/native` (deferred — first mount lands with
  the Drift port).
- **Reduced motion**: every animated surface accepts a
  `reducedMotion?: boolean` prop that collapses the animation loop
  to a static mid-range envelope. The default is sourced from
  `AccessibilityInfo.isReduceMotionEnabled()` once
  `@app/aether-core-native` is consumed.
- **Test IDs**: every Aether mobile component sets a stable
  `testID` (`aether-pulse-glow`, etc.) for Maestro / Detox.

## Env vars

See [`.env.example`](../../.env.example) for the full list. The
Phase 4 surfaces all gate behind `EXPO_PUBLIC_FEATURE_AETHER_PHASE1`;
unset in production until launch-ready.

## See also

- [`docs/aether/15-phase4-plan.md`](../../../../docs/aether/15-phase4-plan.md) — Phase 4 plan + locked decisions
- [`docs/aether/24-round-ar-progress.md`](../../../../docs/aether/24-round-ar-progress.md) — Round AR (Phase 4 kickoff — native foundation packages)
- [`docs/aether/25-round-as-progress.md`](../../../../docs/aether/25-round-as-progress.md) — Round AS (Tamagui-out)
- [`docs/aether/26-round-at-progress.md`](../../../../docs/aether/26-round-at-progress.md) — Round AT (this round — first Aether mobile surface live)
