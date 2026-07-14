# Phase 4 closeout — Mobile parity (code-complete pending device build)

> **Status: Phase 4 is CODE-COMPLETE pending (a) the operator-owned EAS
> device build and (b) the backend b-slices.** Every web Aether surface
> has a React-Native + Expo implementation that typechecks clean and
> draws from the same framework-free math the web uses. Nothing has yet
> rendered on a physical device — that is the single largest remaining
> unknown and is operator-gated (see the handoff checklist).
>
> This is the capstone document for the Phase 4 (mobile parity) arc that
> ran across rounds **AR → BF** (AE513 → AE582). It inventories every
> surface, hook, fixture, and shared-math dependency; records the three
> locked decisions; lists the pre-device audit findings; and hands the
> remaining device + backend work to the operator.

---

## 1. The three locked decisions (2026-06-01, held all the way through)

| #   | Decision           | Locked answer                                                                                                                  | Where it lives                                                    |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Tamagui-out vs in  | **Tamagui-out** — plain RN primitives, parity with web's no-design-system stance.                                              | Round AS stripped it (-124 lockfile pkgs).                        |
| 2   | Skia vs R3F native | **R3F-native for depth, Skia-flat for flat.**                                                                                  | Frozen map in `@app/aether-canvas-native/src/renderer-policy.ts`. |
| 3   | Build target       | **Single binary, env-flag gated** — one Expo binary for both stores, `EXPO_PUBLIC_FEATURE_AETHER_PHASE1` mirrors the web flag. | `eas.json` dev + preview profiles set the flag.                   |

---

## 2. Surface inventory — all 10 ported

Renderer per decision #2: **7 R3F-native** (depth) + **3 Skia** (flat).
Every scene imports its geometry/colour/lifecycle math **verbatim** from
`@app/aether-canvas-shared` — the web R3F scene and the mobile scene
compute identical positions, so the two renderers never drift.

| #   | Surface   | Renderer | Scene file (`src/aether/`)                     | Route (`app/aether/`) | Interaction                                  | `@app/aether-canvas-shared` math                                                                                                                                                                                |
| --- | --------- | -------- | ---------------------------------------------- | --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pulse     | Skia     | `pulse-glow.tsx`                               | _global overlay¹_     | ambient (breathing glow)                     | `pulseBreathAt`                                                                                                                                                                                                 |
| 2   | Drift     | R3F      | `drift-scene.tsx`                              | `drift.tsx`           | ambient (sun + mote field)                   | `ambientFieldPositionArray`, `sunDiskRotation`, `DEFAULT_DRIFT_BOUNDS`, `DEFAULT_DRIFT_MOTE_COUNT`, `cameraPoseAt`                                                                                              |
| 3   | Atlas     | R3F      | `atlas-scene.tsx`                              | `atlas.tsx`           | tap orb → place card (`useR3FSelection`)     | `layoutOrbsForTrip`, `layoutDayMarkers`, `orbColorForItem`, `orbSizeForItem`, `cameraPoseAt`                                                                                                                    |
| 4   | Compass   | R3F      | `compass-scene.tsx`                            | `compass.tsx`         | **real device heading** (`useDeviceHeading`) | `CARDINALS`, `bearingPositionOnRing`                                                                                                                                                                            |
| 5   | Continuum | Skia     | `continuum-sigil.tsx`                          | `continuum.tsx`       | ambient (sigil)                              | `buildSigilGrid`, `sigilCellRects`, `sigilPixelSize`, `DEFAULT_SIGIL_SIZE`                                                                                                                                      |
| 6   | Lumen     | R3F      | `lumen-scene.tsx`                              | `lumen.tsx`           | tap plane → photo card (`useR3FSelection`)   | `layoutPhotoCloud`, `DEFAULT_LUMEN_LAYOUT`, `clampRating`, `cameraPoseAt`                                                                                                                                       |
| 7   | Genie     | R3F      | `genie-scene.tsx`                              | `genie.tsx`           | tap → listening FSM                          | `genieIsActive`, `genieMicRingColor`, `genieOnMicPress`, `genieOnMicRelease`, `genieOnStt`, `genieStateLabel`, `ambientFieldPositionArray`                                                                      |
| 8   | Vault     | R3F      | `vault-scene.tsx` + `vault-checkout-panel.tsx` | `vault.tsx`           | tap glyph → checkout (`useR3FSelection`)     | `glyphRingPosition`, `glyphFloatY`, `glyphSphereScale`, `glyphHaloIntensity`, `priceDroppedRecently`, `SAMPLE_VAULT_PRICES`; panel: `checkoutTotal/Title/SubmitLabel/StatusLabel/FooterCopy/DisabledReason` FSM |
| 9   | Echo      | R3F      | `echo-scene.tsx`                               | `echo.tsx`            | swipe → next memory (PanGesture)             | `echoSwipeDirectionFromDelta`, `echoActionForSwipe`, `nextEchoIndex`, `visibleEchoSlots`, `echoCardScale`, `echoCardY`, `echoPaletteFromDominantColor`                                                          |
| 10  | Mirror    | Skia     | `mirror-scene.tsx`                             | `mirror.tsx`          | tap row → expand detail                      | `liveAuditRows`, `auditGlyphColor`, `auditGlyphSymbol`, `auditRowYProgress`                                                                                                                                     |

¹ Pulse is the always-present corner glow, mounted once in
`app/_layout.tsx` above the Stack (flag-gated, AE573) — it has no route
of its own; the other 9 surfaces each get a flag-gated route.

**Interaction: 7/7 non-trivial surfaces interact.** Pulse / Drift /
Continuum are ambient by design (decorative on web too); the other seven
each carry a real gesture/sensor interaction.

---

## 3. Shared hooks (`apps/mobile/lib/`)

| Hook                        | Round      | Used by                | What it does                                                                                                 |
| --------------------------- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `useR3FSelection<T>(getId)` | AE579 (BE) | Vault, Atlas, Lumen    | Tap-to-select state: `{ selected, selectedId, select, close }`. No `three`/R3F types — framework-free.       |
| `useDeviceHeading(enabled)` | AE563/576  | Compass                | `expo-location` `watchHeadingAsync`, trueHeading w/ magHeading fallback; `enabled` gates the permission ask. |
| `useReducedMotionNative()`  | AE532      | every animated surface | `AccessibilityInfo` subscription; collapses each animation loop to a static envelope under OS Reduce Motion. |

---

## 4. Fixtures (synthetic data until backend b-slices wire real feeds)

| Fixture (`src/aether/`)                     | Feeds  | Replaced by (b-slice)                              |
| ------------------------------------------- | ------ | -------------------------------------------------- |
| `sample-trip.ts` (`SAMPLE_LEH_TRIP`)        | Atlas  | real itinerary via `useTripControllerGetItinerary` |
| `sample-lumen.ts`                           | Lumen  | real photos via the media SDK                      |
| `sample-echo.ts`                            | Echo   | the WebTransport memory feed                       |
| `sample-mirror.ts` (`buildSampleAuditRows`) | Mirror | the admin audit stream + `isMirrorViewer` gate     |

Vault reads `SAMPLE_VAULT_PRICES` directly from `@app/aether-canvas-shared`
(not a local fixture) so the web Vault + mobile Vault render the same ring.

---

## 5. The native foundation packages (Round AR)

| Package                     | Tests | Role                                                                                                                                      |
| --------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `@app/aether-canvas-shared` | 745   | The framework-free math (35 modules). Consumed verbatim by web R3F + mobile R3F + mobile Skia. The single source of geometry truth.       |
| `@app/aether-canvas-native` | 10    | `renderer-policy.ts` — the frozen R3F-vs-Skia map (decision #2 made executable).                                                          |
| `@app/aether-core-native`   | 6     | `SurfacePaletteSlotsContext` + `<SurfacePaletteSlotsProvider>` (RN replacement for web's CSS-var palette). **Not yet consumed** — see §7. |
| `@app/aether-audio-native`  | 15    | `NativeAudioEngine` contract + `createNullNativeAudioEngine`. Real `expo-av` wiring lands with Genie audio (b-slice).                     |

---

## 6. Pre-device audit (Round BD) — 7 runtime bugs fixed before the build

An adversarial review→verify pass read the scenes + the installed library
source to catch runtime bugs `tsc` cannot see, then adversarially
verified each finding. All 7 confirmed bugs were fixed (AE570-576):

1. **Lumen** FrontSide planes culled + stopped raycasting mid-rotation → `side={DoubleSide}`.
2. **Genie** double-tap during the listening window stalled the FSM → ignore taps while active + timers out of the setState updater.
3. **Pulse** breathing rAF re-rendered at 60fps → ~20fps React-commit throttle.
4. **Pulse** mounted unconditionally (rendered in production w/ flag off) → flag-gate the mount.
5. **Echo** swipe-hint `setTimeout` untracked (leak + fires after unmount) → ref + clear on new swipe/unmount.
6. **Mirror** `now` frozen at mount (fade never advanced) → tick every second via `setInterval`.
7. **Compass** requested location permission even on the flag-disabled notice → `enabled` param gates the permission.

Full write-up: [`36-round-bd-progress.md`](36-round-bd-progress.md).

---

## 7. Known deferrals (documented, not punted)

- **Palette context wiring** (`@app/aether-core-native`'s
  `SurfacePaletteSlotsContext`). Three blockers make it a later slice,
  not a palette-internals change: (a) pulling `@app/aether-core-native`
  into the isolated mobile workspace drags the monorepo's React-19
  `@types/react` into the React-18 tree (the documented `ReactNode …
bigint` clash); (b) `<SurfacePaletteSlotsProvider>` needs a
  `<SurfaceManagerProvider>` ancestor mobile doesn't mount; (c) scenes
  read colours as module-level `const`s, which a runtime context can't
  feed without a hook. The seam is **made concrete + typed** in
  `apps/mobile/src/aether/palette.ts` (`AETHER_PALETTE_SLOTS` +
  `resolveAetherPaletteSlots`), with the exact 3-step swap recipe in the
  file header. Do it when a slice first needs per-surface palette
  overrides on mobile. (Round BE.)
- **Pulse Skia-thread animation** — the idiomatic `useClock`
  SharedValue path needs `pulseBreathAt` to be worklet-safe; the ~20fps
  throttle is the low-risk interim (Round BD). Revisit in device tuning.
- **Compass Eye AR mode** — deferred to Phase 5 by the original plan;
  Bird-mode rose (shipped) covers ~90% of users.

---

## 8. Test bar (the gate every Phase 4 round held)

- `apps/mobile` typecheck (`cd apps/mobile && pnpm typecheck`): **clean**
  — the primary mobile gate. The package has **no test runner** (RN/Expo
  scenes aren't unit-tested here) and **no eslint config** (`pnpm lint`
  is a pre-existing broken script — see handoff). All correctness that
  can be asserted off-device lives in the canvas-shared math tests.
- `@app/aether-canvas-shared` jest: **745 pass**.
- `@app/aether-{core,canvas,audio}-native` jest: **31 pass** (6 + 10 + 15).
- `apps/web` typecheck: clean (untouched by Phase 4).

---

## 9. Operator handoff checklist

Nothing below can be done from this environment — each needs operator
credentials, a device, or backend work.

### 9a. Ship the binary (operator-owned, EAS)

1. **Push the unpushed history** — ~137 commits across AJ → BF. The
   classifier blocks `git push`; the operator pushes from their terminal.
2. **EAS bootstrap** — `eas login` + `eas project:init` + confirm the
   `eas.json` dev/preview/production build profiles. (`EXPO_PUBLIC_FEATURE
_AETHER_PHASE1=1` is already set on the dev + preview profiles.)
3. **Store accounts** — Apple Developer + Google Play Console (neither
   exists yet); set up TestFlight + Play Internal tracks.

### 9b. Validate on a real device (the biggest unknown)

`tsc` clean ≠ runs. The BD audit reduced but did not remove this risk —
it caught what's visible by reading code. A physical build must confirm:

- **GL context init** under `expo-gl` for all 7 R3F canvases (and memory
  headroom with several mounted across navigation).
- **Gesture-responder behaviour** — Echo PanGesture, the R3F mesh-tap
  raycast hit-testing (Vault/Atlas/Lumen), Mirror Pressable rows.
- **Skia + expo-gl frame timing** — Pulse glow, Continuum sigil, Mirror
  river; confirm the ~20fps Pulse throttle reads smooth.
- **Magnetometer / heading** accuracy + the trueHeading→magHeading
  fallback on Compass.
- **OS Reduce Motion** actually freezes every animated surface.

### 9c. Backend b-slices (unblock the synthetic fixtures)

- **Genie** — Whisper STT via ai-service `/v1/transcribe` + `expo-camera`
  for camera mode; real `expo-av` recording → `@app/aether-audio-native`.
- **Echo + Continuum** — WebTransport feed (`WT_FEED_URL` /
  `WT_PRESENCE_URL`); real memory + presence channels.
- **Vault** — real Stripe via `@stripe/stripe-react-native` behind the
  AE500 vault-checkout FSM.
- **Mirror** — the admin audit stream + the `isMirrorViewer` role gate +
  an in-app signed-admin-token fallback (web uses IP allowlist).
- **Atlas / Lumen** — real itinerary + photo wiring to replace the
  sample fixtures.

### 9d. Tooling debt

- **Add `eslint.config.mjs` to `apps/mobile`** — the isolated workspace
  never got an ESLint-9 flat config, so `pnpm lint` (`eslint app lib`)
  errors out. Every Phase 4 round gated on typecheck alone.
- **Palette-context wiring** — the §7 deferral; recipe in `palette.ts`.

---

## 10. What comes after Phase 4

Per [`04-sequencing.md`](04-sequencing.md): **Phase 5 — Predictive +
Perception** (incl. the deferred Compass Eye AR) and **Phase 6 — Polish
at AAA**. Both are design-gated and far out; neither starts until Phase 4
actually ships from a device.

---

## See also

- [`37-round-be-progress.md`](37-round-be-progress.md) — Round BE (Mirror tap · `useR3FSelection` · palette seam)
- [`36-round-bd-progress.md`](36-round-bd-progress.md) — Round BD (adversarial pre-device audit)
- [`15-phase4-plan.md`](15-phase4-plan.md) — the Phase 4 plan this closes out
- [`04-sequencing.md`](04-sequencing.md) — the six-phase plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — the live surface component table
