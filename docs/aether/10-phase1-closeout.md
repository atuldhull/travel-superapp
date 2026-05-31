# Phase 1 closeout — AE374 → AE397

> Snapshot of the Aether 2.0 Phase 1 R3F trip-loop rebuild as it landed.
> Behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`. The Phase 0 editorial
> preview (rounds W → AN, AE206 → AE373) remains the default when the
> flag is off.

## Scope shipped

Per [`04-sequencing.md`](04-sequencing.md), Phase 1 owes:

- **Drift** (`/`) — 3D home surface with breathing camera + audio
- **Atlas** (`/trips/[id]`) — 3D trip studio
- **Pulse** — always-present AI corner glow
- **Compass Bird** — desktop nav (Atlas mode)
- **Continuum bar** — basic QR handoff
- Tone.js audio worklet
- Phase 1 routing manager

All seven are live in `apps/web` behind the flag.

## Surface inventory

| Surface       | Route                 | R3F scene                  | Lifecycle | Audio key | Palette source         |
| ------------- | --------------------- | -------------------------- | --------- | --------- | ---------------------- |
| Drift         | `/aether/drift`       | `drift-phase1-scene.tsx`   | breathing | `goa`     | registered + per-day   |
| Atlas         | `/aether/journey/:id` | `atlas-phase1-scene.tsx`   | breathing | `leh`     | AE384 destination slug |
| Compass Bird  | `/aether/atlas`       | `compass-phase1-scene.tsx` | breathing | `jaipur`  | registered             |
| Pulse         | overlay               | `pulse-phase1-scene.tsx`   | (host)    | n/a       | host surface palette   |
| Continuum bar | overlay               | HTML-only (no R3F)         | n/a       | n/a       | host surface palette   |

## Capability stack

Every Phase 1 surface composes:

1. **`<SurfaceManagerProvider>`** (AE374) — registry + 5-phase FSM
2. **`<SurfaceCanvas>` + `<LifecycleCameraDriver>`** (AE375) — useFrame-driven camera
3. **`<SurfaceAudioLayer>` + `useSceneAudioBridge`** (AE376 + AE380) — Tone.js drone
4. **`<SurfacePaletteVars>` + `<SurfacePaletteOverride>`** (AE381 + AE384) — CSS-var palette
5. **`useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN)`** (AE382) — `idle → materialising → settling → listening → dissolving → idle` ≈ 10s breath
6. **`<DissolvingLink>` / `<Phase1DevNav>`** (AE383) — navigation-triggered dissolve
7. **`<Phase1PulseOverlay onActivate>`** (AE389 + AE392) — corner glow, wired to AE96 `aether-pulse-open` bridge
8. **`<Phase1ContinuumBar>` + `<Phase1ContinuumReceiverToast>`** (AE390 + AE391) — bidirectional handoff

## Drift-specific extras

- **`<DriftNowCard>`** — text-rich 2D overlay (AE385 + AE386) that breathes with the lifecycle
- **AE393 persona content** — `<UpcomingTripProvider>` flows the nearest-upcoming trip into the card. Bucketed: today → "Trip day"; 1..7 days → "<N> days until <title>"; 8..30 days → "Polish the plan"; > 30 days → time-of-day fallback.

## Atlas-specific extras

- **Trip palette** — `<SurfacePaletteOverride>` re-tints Atlas from `trip.title` (Leh = cool mountain, Goa = sea+sand, Kerala = palm green, etc.)
- **Weather** — AE395 fetches Open-Meteo for the trip's destination coords + start date. Falls back to AE388 simulation when coords aren't curated, the date is missing, or the fetch fails.
- **`<WeatherStreaks>`** — particle field, intensity driven by `WeatherState` (clear / rain / storm)
- **Continuum trip-aware toast** — AE394 `messageOverride` injects the trip title

## Continuum protocol

```
sender                                       receiver
  │                                            │
  │ click 4px edge-line                        │
  │   → popover opens                          │
  │   → buildContinuumUrl(state, origin)       │
  │   → 21×21 sigil from hash(seed)            │
  │   → Copy / Share                           │
  │                                            │
  │  ───  URL: /aether/journey/abc?            │
  │       trip=abc&aether-continuum=1 ──▶      │
  │                                            │
  │                              useContinuumLanding() reads
  │                              ?aether-continuum=1
  │                              → readContinuumLanding(params)
  │                              → formatContinuumLandingMessage(extras)
  │                              → <Phase1ContinuumReceiverToast> (4.5s)
  ▼                                            ▼
```

Visual identity is the sigil; trust is the deep link.

## Decisions resolved by example

Of the 8 Phase 0 decisions [`06-decisions.md`](06-decisions.md) flagged, Phase 1 answers six:

| Decision          | Phase 1 answer                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- |
| Brand language    | Warm Italian baseline (AE381) + per-destination override (AE384)                   |
| Audio default     | Mandatory but respects `prefers-reduced-motion` + audio-opt-out (AE376 + AE380)    |
| Audio activation  | One-shot `pointerdown` triggers `engine.activate()` (AE380)                        |
| Launch platform   | Web-first; mobile + native land Phase 2+                                           |
| Continuum scope   | Deep-link fallback + visual sigil; WebTransport state-sync deferred to Phase 4     |
| Pulse interaction | Tap corner glow → AE96 `aether-pulse-open` bridge → editorial Pulse drawer (AE392) |

Two are still nominally unresolved (premium-gating, AR Eye on mobile).

## Deferred to Phase 2+

- **Genie** voice/camera modal (Pulse hold-to-talk)
- **Lumen** memory book editor
- **Echo** social feed
- **Vault** booking commerce
- **Mirror** admin forensics
- **Real Compass Bird** with Mapbox 3D buildings + GTFS feeds — needs Mapbox token (operator-owed)
- **Persona embedding** (Tier 4 T4-Ag.1) — Pulse responses align with user taste over 30 trips
- **OPFS Predictor** for surface pre-warming
- **Continuum WebTransport** real state sync (camera angle + scroll + open trip orbits)
- **Apple Continuity** native handoff on iOS

## Test totals (post Phase 1)

| Package              | Count                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `@app/aether-core`   | 127 jest specs (registry + lifecycle + manager + mount + palette + destination-palettes + palette-hooks) |
| `@app/aether-canvas` | 69 jest specs (canvas + lifecycle camera + depth-fog + particle-burst + weather-streaks)                 |
| `@app/aether-audio`  | 71 jest specs (destination-keys + note-picker + scene-mixer + scene-audio-bridge)                        |
| `apps/web`           | 1682 vitest across 176 files                                                                             |

All four typecheck clean. Zero new lint errors (19 pre-existing AE351 baseline).

## Operator-owed for Phase 1 promotion

- `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` on prod (route still 404s when unset, so deploys with flag off ship safely)
- Push the AE374 → AE397 commit chain (`git push origin main` — classifier blocks the CLI; only operator)
- No new secrets / DNS / API keys required for Phase 1
- Open-Meteo is a no-key public API; rate-limit is per-IP, not per-app

## Phase 1 commit chain

```
AE374 3fe7e81  @app/aether-core Surface manager
AE375 836bc92  @app/aether-canvas Surface bridge + R3F primitives
AE376 bf351c2  @app/aether-audio (Tone.js destination keys + scene mixer)
AE377 278dd08  First Drift R3F surface live
AE378 ad56b1f  Atlas Phase 1 surface (trip timeline + place orbs)
AE379 78b351d  Compass Bird Phase 1 surface (rose + cardinal markers)
AE380 1dde3ba  Audio bridge — Tone.js actually plays
AE381 a4e35ba  Per-surface palette derivation
AE382 e2ef66e  BREATHING_LIFECYCLE_PLAN closes the loop
AE383 bef258a  Navigation-triggered dissolve via <DissolvingLink>
AE384 ff9f623  Atlas re-tints per-destination
AE385 fdd0019  Drift Now Card foreground
AE386 a2217fe  DriftNowCard breathes with the lifecycle
AE387 753ed8f  useLifecycleEvents hook
AE388 a6179f8  Atlas weather streaks (simulation)
AE389 d7c58b0  Pulse Phase 1 overlay scene
AE390 cb695f6  Continuum bar overlay (sender)
AE391 6a0fd60  Continuum receiver toast
AE392 e157b57  Pulse onActivate → aether-pulse-open bridge
AE393 d45c44c  Persona-aware Now Card (upcoming-trip)
AE394 c8b00dc  Continuum receiver Atlas-aware messageOverride
AE395 f684027  Real weather via Open-Meteo
AE396 6c1257d  Symmetric Pulse mount loader + Pulse palette baseline
AE397 (this)   Phase 1 closeout docs
```

## See also

- [`02-surfaces.md`](02-surfaces.md) — full surface catalogue
- [`04-sequencing.md`](04-sequencing.md) — Phase 2..6 roadmap
- [`07-implementation-log.md`](07-implementation-log.md) — chronological per-slice log
- [`08-data-flow.md`](08-data-flow.md) — ASCII flow diagrams
- [`09-component-catalog.md`](09-component-catalog.md) — every component + which page mounts it
