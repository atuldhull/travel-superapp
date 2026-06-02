# Phase 4 plan — Mobile parity

> Status as of 2026-06-01. Phase 4 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md), weeks 41-56): "Every Surface
> ships native-quality on mobile." This document scopes the work, lists
> the existing mobile-workspace state, and locks the per-surface port
> order.
>
> **Decisions locked 2026-06-01 — Phase 4 code in progress.** See the
> "Decisions — locked" section below. Round AR (AE513 → AE517) kicks
> off the three foundation packages.
>
> **✅ CODE-COMPLETE @ 2026-06-02 (rounds AR → BF, AE513 → AE582).** All
> 10 surfaces ported (7 R3F + 3 Skia), 7/7 non-trivial surfaces interact,
> mobile typecheck clean. The remaining work is the operator-owned EAS
> device build plus the backend b-slices. Full inventory + handoff:
> [`38-phase4-closeout.md`](38-phase4-closeout.md).

## Goal

Rebuild **every web surface** for React Native + Expo so the Aether 2.0
visual + interaction language ships native-quality on iOS + Android.
This is not a port; it's a parallel implementation that shares the
data + auth + SDK layers with the web app but draws its own renderer.

## What the existing mobile workspace already has

The `apps/mobile/` workspace is **isolated** from the monorepo
(installed via `pnpm install --ignore-workspace` from `apps/mobile/`).
Today it carries:

- **Expo 51** + **expo-router 3.5** scaffold
- **Tamagui 1.121** as the UI primitive layer (will be stripped out
  exactly like we stripped it from `apps/web/` in Phase 0)
- **React Native 0.74**, **react-native-reanimated 3.10**,
  **react-native-gesture-handler 2.16**, **react-native-svg 15.2**
- **`@app/sdk`** linked locally (`link:../../packages/sdk`)
- **expo-secure-store** for token storage (parity with the web
  httpOnly-cookie + in-memory access-token pattern)
- **`@tanstack/react-query` + persist-client + async-storage-persister**
  for offline-first caching
- A handful of 1.0 mirror routes under `app/` (auth + trip + memory-book
  - inbox) that the Phase 4 build will retire and replace.

## What's missing for Phase 4

The web surfaces lean on a stack that doesn't exist yet for native:

| Web stack                                               | Native equivalent for Phase 4                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@react-three/fiber` + Three.js + drei + postprocessing | `expo-three` + `@react-three/fiber/native` (R3F has native bindings) or a Skia 2D path for surfaces that don't need 3D depth |
| WebGPU (where supported)                                | Drop to WebGL2 via expo-three for parity; raw native WebGPU is years out                                                     |
| Tone.js                                                 | `expo-av` + a Skia-rendered analog drone, or precomputed AAC loops for each destination key signature                        |
| `<SurfacePaletteVars/>` CSS custom properties           | React Context with the same palette slot names; no CSS vars on RN                                                            |
| `next/dynamic` lazy imports                             | `expo-router` route splitting + `Suspense + lazy` for surface scenes                                                         |
| Pointer / wheel / keyboard gestures                     | `react-native-gesture-handler` (PanGesture, PinchGesture, LongPress)                                                         |
| Window-level `keydown` listeners                        | RN doesn't have a keyboard model on phones; desktop Catalyst / RN-Windows defer to Phase 6                                   |
| Continuum QR + WebTransport                             | Apple Continuity (iOS) + NFC handoff (both platforms) + WebTransport client via expo-web-browser fallback                    |
| AR (Compass Eye)                                        | `expo-three` + ARKit/ARCore via Expo modules (still deferred to Phase 5)                                                     |

## Surface-by-surface port plan

Ordered by user impact + dependency depth so each slice can ship
independently. Each surface lands its native version behind the same
`EXPO_PUBLIC_FEATURE_AETHER_PHASE1` flag the web uses.

| Order | Surface   | Port complexity | Notes                                                                                                                           |
| ----- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Pulse     | low             | Skia 64-px corner glow + breathing math; reuse the AE389 pure breathing helpers verbatim.                                       |
| 2     | Drift     | medium          | R3F native (expo-three) for the SunDisk + AmbientField + Now Card overlay. Time-of-day palette reads from Phase 4 hooks.        |
| 3     | Atlas     | high            | The trip studio + PlaceOrb physics + draggable timeline. `react-native-gesture-handler` drives drag; Cannon-es runs in JS.      |
| 4     | Compass   | medium          | Bird-mode rose works as-is via R3F native. Eye-mode AR stays deferred to Phase 5.                                               |
| 5     | Continuum | medium          | iOS Continuity (Handoff API via Expo modules) + Android NFC; WebTransport client via `@firefox/webtransport` polyfill.          |
| 6     | Lumen     | high            | Photo cloud renders fine in R3F native; the trick is `<PhotoPlane>` texture loading via Expo Asset.                             |
| 7     | Genie     | high            | `expo-av` for recording + Whisper STT via ai-service; `expo-camera` for camera mode; SVG dissolve overlay via react-native-svg. |
| 8     | Vault     | medium          | Sphere ring scene + Stripe Checkout via `@stripe/stripe-react-native`. Material wrapping reuses the AE415 panel shape.          |
| 9     | Echo      | medium          | TikTok-style vertical FlatList of textured planes; `react-native-gesture-handler` PanGesture for swipe.                         |
| 10    | Mirror    | low (mobile)    | Mobile admin is the same data but minus the audit-river overlay (no room on phone). Cmd+K palette → bottom-sheet picker.        |

**✅ All 10 ported + routed (rounds AT → BF).** Per-surface scene files,
routes, interactions, and shared-math dependencies are inventoried in
[`38-phase4-closeout.md`](38-phase4-closeout.md) §2. The interaction
depth (tap/swipe/sensor) on the 7 non-trivial surfaces landed in rounds
BA → BE.

## Shared cross-cutting work

Before any surface ports, three foundations need to land:

1. **`@app/aether-canvas/native`** — Mirror the web canvas package's
   `SurfaceCanvas` + `<DepthFog>` + `<ParticleBurst>` etc. for R3F
   native. The pure helpers (`cameraPoseAt`, `phaseProgress`,
   `lerpVec3`, `linearFogDensity`, etc.) move to a `@app/aether-canvas-shared`
   sub-package that both web + native import.
2. **`@app/aether-core/native`** — Re-export the surface manager + the
   palette helpers, with `<SurfacePaletteVars/>` swapped for a
   React-Context-only version (no CSS vars on RN).
3. **`@app/aether-audio/native`** — Tone.js becomes `expo-av` +
   precomputed AAC drone loops keyed by destination. The pure
   `scene-mixer.ts` math ships verbatim.

## Decisions — locked 2026-06-01

The three blocking choices were locked at the recommended defaults
when Phase 4 work started:

| #   | Decision           | Locked answer                                                                                                                                   |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tamagui-out vs in  | **Tamagui-out** — parity with web's no-design-system stance; drop the dep + replace primitives.                                                 |
| 2   | Skia vs R3F native | **R3F-native for depth, Skia-flat for flat** — R3F via expo-three for Drift/Atlas/Lumen/Compass/Vault/Echo; Skia for Pulse glow + Mirror admin. |
| 3   | Build target       | **Single binary, env-flag gated** — one Expo binary for both stores, `EXPO_PUBLIC_FEATURE_AETHER_PHASE1` mirrors the web flag.                  |

These three set the foundation for the cross-cutting work below.
Code starts with the three foundation packages (AE514 → AE516) and
the surface ports follow once the foundations typecheck cleanly.

## Timeline (per `04-sequencing.md`)

- Weeks 41–56 (≈4 months) on the published plan.
- Honest range with the established team posture (solo + composer
  contract): 6-7 months because each surface needs design parity work
  the web didn't.

## Operator-owed for Phase 4 kick-off

1. EAS bootstrap (`eas init` + `eas.json` build profiles) — required
   before the first internal TestFlight / Play Internal cut.
2. Apple Developer account + Play Console account — neither exists yet.
3. ADMIN_IP_ALLOWLIST + `promote-user.sh` are web-only today; mobile
   admin needs an in-app fallback (signed admin token).
4. `WT_FEED_URL` + `WT_PRESENCE_URL` envs for the live channels;
   mobile uses the same back-end endpoints as web.

## See also

- [`14-phase3-closeout.md`](14-phase3-closeout.md) — Phase 3 closeout
- [`04-sequencing.md`](04-sequencing.md) — six-phase plan + decision lock
- [`01-architecture.md`](01-architecture.md) — runtime layers each surface uses
- [`06-decisions.md`](06-decisions.md) — the 8 Phase 0 decisions
- [`apps/mobile/README.md`](../../apps/mobile/README.md) — current mobile workspace state
