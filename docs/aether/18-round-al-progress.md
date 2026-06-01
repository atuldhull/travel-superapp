# Round AL progress — canvas-shared completion + cross-package contract

> Round AL adds 12 slices (AE469 → AE481) layered on top of Round AK.
> The round splits cleanly into two buckets:
>
> 1. **Phase 4 mobile-parity prep (AE469-AE481)** — eight inline
>    extractions move the remaining pure helpers from Phase 1-3 web
>    files into `@app/aether-canvas-shared`. After this round the
>    shared package owns 35 framework-free modules and every web
>    phase{1,2,3}/.ts pure file is a thin re-export.
> 2. **Polish + cross-package contract (AE472-AE476)** — four slices
>    shipped via a parallel implementation workflow: cross-package
>    lifecycle handoff integration spec, a11y sweep for TripShareCard
>    - Phase 3 overlays, url-ttl edge-case specs, paletteSlotIndex
>      edge-case specs.

## Slice inventory

| Slice | Title                                                                                   | Files                                                                                                         | Tests added                  |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AE469 | Move Genie state + particles + camera + recorder to canvas-shared                       | 4 modules + 4 re-exports                                                                                      | 104 tests pass via re-export |
| AE470 | Move Continuum state + sigil + landing to canvas-shared                                 | 3 modules + 3 re-exports                                                                                      | 60 tests pass via re-export  |
| AE471 | Move Mirror globe + investigate to canvas-shared                                        | 2 modules + 2 re-exports                                                                                      | 81 tests pass via re-export  |
| AE477 | Move echo-feed + live-trip-watch to canvas-shared                                       | 2 modules + 2 re-exports                                                                                      | 85 tests pass via re-export  |
| AE478 | Move 5 Lumen interaction helpers (museum/pinch/strategies/selection/keyboard) to shared | 5 modules + 5 re-exports                                                                                      | 112 tests pass via re-export |
| AE479 | Move Vault + Pulse hold-to-talk + url-ttl to canvas-shared                              | 5 modules (vault-glyphs / vault-checkout / vault-sample-prices / pulse-hold-to-talk / url-ttl) + 5 re-exports | 117 tests pass via re-export |
| AE480 | Move now-card-lifecycle + upcoming-trip to canvas-shared                                | 2 modules + 2 re-exports                                                                                      | 37 tests pass via re-export  |
| AE481 | Shape-gate spec for @app/aether-canvas-shared                                           | `packages/aether-canvas-shared/test/index-shape.spec.ts`                                                      | +12                          |
| AE472 | Cross-package lifecycle handoff integration spec (core + canvas + audio)                | `packages/aether-canvas/test/aether-lifecycle-integration.spec.ts`                                            | +21                          |
| AE474 | A11y sweep for TripShareCard + Phase 3 overlays                                         | trip-share-card.tsx + live-trip-watch-overlay.tsx + mirror-audit-river.tsx                                    | (no new tests)               |
| AE475 | Edge-case specs for url-ttl refetch timing                                              | `apps/web/test/lib/url-ttl.spec.ts`                                                                           | ~+15                         |
| AE476 | Edge-case specs for paletteSlotIndex + paletteSlotName                                  | `packages/aether-core/test/surface/palette.spec.ts`                                                           | +10                          |

Total: 12 commits, ~58 new spec assertions, 26 modules now living
in canvas-shared (12 from Round AK + 14 new in Round AL minus
1 cleanup), 96+ tests cycling through re-exports.

## Deferred to Round AM

| Slice | Why deferred                                                                                                                                                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AE473 | Phase 1 API surface shape-gate (the Round AK deferred AE460) — the slice agent stalled in the parallel workflow trying to run a competing vitest while another agent was already running one. The spec design (`vi.mock @app/sdk + @tanstack/react-query at top of file`) is sound; just needs to be authored inline next round. |

## Test bar

- `pnpm --filter web test` (vitest): essentially unchanged from
  Round AK (~2417 + ~15 from AE475 url-ttl edge specs = ~2432)
- `pnpm --filter @app/aether-canvas test`: 77 → 98 (+21 cross-pkg integration)
- `pnpm --filter @app/aether-core test`: 129 → 139 (+10 palette edge cases)
- `pnpm --filter @app/aether-canvas-shared test`: 0 → 12 (new shape gate)
- All packages typecheck clean.

## Routes still 200

Unchanged from Round AK. All 19 `/aether/*` routes serve.

## What landed under `@app/aether-canvas-shared` after Round AL

```
packages/aether-canvas-shared/src/        (35 files)
├── index.ts                              # barrel
├── lifecycle-progress.ts                 # AE454 (Round AK)
├── lifecycle-camera.ts                   # AE454 (Round AK)
├── pulse-breathing.ts                    # AE455 (Round AK)
├── atlas-orbs.ts                         # AE456 (Round AK)
├── compass-rose.ts                       # AE456 (Round AK)
├── lumen-cloud.ts                        # AE456 (Round AK)
├── vault-glyph-positions.ts              # AE456 (Round AK)
├── echo-layout.ts                        # AE456 (Round AK)
├── weather-simulation.ts                 # AE457 (Round AK)
├── now-card-content.ts                   # AE457 (Round AK)
├── destination-coords.ts                 # AE457 (Round AK)
├── genie-state.ts                        # AE469 (Round AL)
├── genie-particles.ts                    # AE469 (Round AL)
├── genie-camera.ts                       # AE469 (Round AL)
├── genie-recorder.ts                     # AE469 (Round AL)
├── continuum-state.ts                    # AE470 (Round AL)
├── continuum-sigil.ts                    # AE470 (Round AL)
├── continuum-landing.ts                  # AE470 (Round AL)
├── mirror-globe.ts                       # AE471 (Round AL)
├── mirror-investigate.ts                 # AE471 (Round AL)
├── echo-feed.ts                          # AE477 (Round AL)
├── live-trip-watch.ts                    # AE477 (Round AL)
├── lumen-museum.ts                       # AE478 (Round AL)
├── lumen-pinch.ts                        # AE478 (Round AL)
├── lumen-strategies.ts                   # AE478 (Round AL)
├── lumen-selection.ts                    # AE478 (Round AL)
├── lumen-keyboard.ts                     # AE478 (Round AL)
├── vault-glyphs.ts                       # AE479 (Round AL)
├── vault-checkout.ts                     # AE479 (Round AL)
├── vault-sample-prices.ts                # AE479 (Round AL)
├── pulse-hold-to-talk.ts                 # AE479 (Round AL)
├── url-ttl.ts                            # AE479 (Round AL)
├── now-card-lifecycle.ts                 # AE480 (Round AL)
└── upcoming-trip.ts                      # AE480 (Round AL)
```

35 pure modules. Every dependency is type-only (`SurfaceLifecyclePhase`
from `@app/aether-core` is the only one). No React, no DOM, no Three.js,
no R3F. The Phase 4 native canvas package can consume the entire barrel
without pulling a single peer dep that Hermes can't reach.

## Cross-package contract (AE472)

The integration spec at `packages/aether-canvas/test/aether-lifecycle-
integration.spec.ts` pins the three-way handoff:

```
@app/aether-core   ── lifecycle FSM (idle → materialising → settling →
                     listening → dissolving → idle)
   │
   ▼  phase
@app/aether-canvas ── easedPhaseProgress + cameraPoseAt
@app/aether-audio  ── channelGainsAt (drone + events channels)
```

For each phase transition, the spec verifies all three modules
co-evolve correctly: pose interpolation, audio channel gains, and
the FSM all advance in lockstep. The contract Phase 4 native R3F +
Tone-on-RN must reproduce exactly.

## A11y sweep (AE474)

Three single-attribute additions to keep visual behaviour unchanged:

- `trip-share-card.tsx` — `aria-label` on the download button +
  `role="img"` + `aria-label` on the SVG preview div (was an
  unlabeled `dangerouslySetInnerHTML`).
- `live-trip-watch-overlay.tsx` — `role="status"` on the outer
  `<aside>` (the inner sr-only span retains its own `aria-live`).
- `mirror-audit-river.tsx` — `role="log"` on the outer `<aside>`
  (chronological audit log of appended events).

All 16 existing integration specs continue to pass.

## Workflow stats

Round AL ran 2 workflows (the discovery workflow lives in Round AK):

| Workflow             | Agents | Subagent tokens | Duration | Outcome                                              |
| -------------------- | ------ | --------------- | -------- | ---------------------------------------------------- |
| AL polish (5 slices) | 5      | ~412k           | ~26 min  | 4/5 returned — AE473 stalled on competing vitest run |

The AE473 api-surface stall was a resource-contention issue (one
agent kicked off a vitest while another was already running one;
the second hung at ~2.6 GB RSS). The fix for Round AM is to author
that slice inline (it's a small file) instead of through the
parallel workflow.

## Operator-owed

- Push the AE469 → AE481 commit chain (12 commits this round + the
  Round AK chain still unpushed). 24+ unpushed commits across the
  two rounds.
- Three Phase 4 decisions still pending (Tamagui-out / R3F-native
  vs Skia / single-binary) + EAS bootstrap before mobile code starts.
- Backend b-slices remain owed (Whisper STT, CLIP, ML-Kit, Stripe,
  WebTransport feed + presence, live admin SDK, Meilisearch).

## See also

- [`17-round-ak-progress.md`](17-round-ak-progress.md) — Round AK closeout
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`packages/aether-canvas-shared/`](../../packages/aether-canvas-shared/) — the shared package (now 35 modules)
