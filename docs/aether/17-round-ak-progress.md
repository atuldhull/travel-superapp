# Round AK progress — `@app/aether-canvas-shared` + Phase 1 polish

> Round AK adds 11 slices (AE453 → AE466) layered on top of Round AJ.
> The round splits cleanly into two buckets:
>
> 1. **Phase 4 mobile-parity prep (AE453-AE457)** — five inline slices
>    create the new `@app/aether-canvas-shared` workspace package and
>    move 10 pure modules into it. Web callsites stay valid via thin
>    re-exports; the Phase 4 native canvas (when it lands) consumes
>    identical math without R3F peer deps.
> 2. **Polish + coverage (AE459-AE466)** — five slices shipped via a
>    parallel implementation workflow (8 subagents, one per slice).
>    Phase 1 shell integration specs, Lumen integration specs,
>    Storybook variants, loading skeletons, and Phase 3 boundary specs.

## Slice inventory

| Slice | Title                                                                  | Files                                                                                                       | Tests added                  |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AE453 | Scaffold `@app/aether-canvas-shared` package                           | `packages/aether-canvas-shared/{package.json,tsconfig.json,jest.config.cjs,eslint.config.mjs,src/index.ts}` | scaffold only                |
| AE454 | Move `lifecycle-progress` + `lifecycle-camera` to shared               | `packages/aether-canvas-shared/src/{lifecycle-progress,lifecycle-camera}.ts` + thin re-exports              | 77 tests pass via re-export  |
| AE455 | Move `pulse-breathing` math to shared                                  | `packages/aether-canvas-shared/src/pulse-breathing.ts` + thin re-export                                     | 16 tests pass via re-export  |
| AE456 | Move 5 spatial-layout modules to shared                                | atlas-orbs + compass-rose + lumen-cloud + vault-glyph-positions + echo-layout                               | 134 tests pass via re-export |
| AE457 | Move weather + now-card + destination-coords to shared                 | weather-simulation + now-card-content + destination-coords                                                  | 42 tests pass via re-export  |
| AE459 | jsdom integration specs for Phase 1 shells (Drift + Atlas + Compass)   | `apps/web/test/lib/phase1-{drift,atlas,compass}-shell.spec.tsx`                                             | +24                          |
| AE461 | Extract `isInAppClick` to a pure helper + 16 specs                     | `apps/web/src/components/aether/phase1/is-in-app-click.ts` + spec + dissolving-link import update           | +16                          |
| AE462 | Integration specs for `<LumenFocusAnnouncer/>` + `<LumenPhotoSlot/>`   | `apps/web/test/lib/lumen-{focus-announcer,photo-slot}-integration.spec.tsx`                                 | +20                          |
| AE463 | Storybook variants for 4 missing components                            | LumenPhotoSlot, LumenFocusAnnouncer, Phase1PulseOverlay, Phase1DevNav stories                               | n/a (12+ variants)           |
| AE464 | Loading skeletons for `/aether/vault` + `/aether/memory/[id]`          | 2 new `loading.tsx` server components                                                                       | n/a                          |
| AE466 | Phase 3 edge-case specs (mirror-investigate + echo-layout + echo-feed) | 3 spec file extensions                                                                                      | +36                          |

Total: 11 commits, ~96+ new web vitest specs.

## Deferred to Round AL

| Slice | Why deferred                                                                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AE458 | Cross-package lifecycle integration spec — needs a 3-way mock harness for aether-core + canvas + audio                                                                                                                                                      |
| AE460 | Phase 1 API surface shape-gate — the barrel transitively imports `@app/sdk` + `@tanstack/react-query`, vitest can't resolve at test time without a deeper mock setup. Spec was authored + deleted; will land when the test harness adds SDK boundary mocks. |
| AE465 | Editorial helpers (`buildShareCardTagline`, `shareCardTitleSize`, `relatedDestinations`, `relatedArticles`) — duplicate spec files already exist under different paths; agent correctly detected the overlap and skipped to avoid duplicates.               |
| AE467 | A11y sweep for TripShareCard + Phase 3 R3F scenes — lower priority than Phase 4 prep; defer to Round AL                                                                                                                                                     |

## Test bar

- `pnpm --filter web test` (vitest): **2316 → ~2412** (+96)
- `pnpm --filter @app/aether-canvas test`: 77/77 ✓ via re-export
- `pnpm --filter @app/aether-canvas-shared test`: passWithNoTests (no specs yet — the moved modules' specs still live in aether-canvas and apps/web)
- `pnpm --filter aether-storybook typecheck`: clean
- `pnpm --filter web typecheck`: clean

## Routes still 200

- All 19 `/aether/*` routes have a `loading.tsx` server skeleton now.
- New skeletons: `/aether/vault` (Phase 2 photo-gallery) + `/aether/memory/[id]` (Phase 2 Lumen)

## What landed under `@app/aether-canvas-shared`

After AE453-AE457 the new shared package contains 10 pure modules:

```
packages/aether-canvas-shared/src/
├── index.ts                       # barrel
├── lifecycle-progress.ts          # AE454 (was packages/aether-canvas)
├── lifecycle-camera.ts            # AE454 (was packages/aether-canvas)
├── pulse-breathing.ts             # AE455 (was apps/web phase1)
├── atlas-orbs.ts                  # AE456 (was apps/web phase1)
├── compass-rose.ts                # AE456 (was apps/web phase1)
├── lumen-cloud.ts                 # AE456 (was apps/web phase2)
├── vault-glyph-positions.ts       # AE456 (was apps/web phase2)
├── echo-layout.ts                 # AE456 (was apps/web phase3)
├── weather-simulation.ts          # AE457 (was apps/web phase1)
├── now-card-content.ts            # AE457 (was apps/web phase1)
└── destination-coords.ts          # AE457 (was apps/web phase1)
```

All depend ONLY on `@app/aether-core` for the `SurfaceLifecyclePhase`
type (and `Vec3Tuple` is now exported from canvas-shared itself).
None pull in React, DOM, Three.js, or R3F.

## Phase 4 readiness

The Phase 4 plan in [`15-phase4-plan.md`](15-phase4-plan.md) called out
"`@app/aether-canvas/native` — Mirror the web canvas package's
`SurfaceCanvas` + `<DepthFog>` + `<ParticleBurst>` etc. for R3F native.
The pure helpers (`cameraPoseAt`, `phaseProgress`, `lerpVec3`,
`linearFogDensity`, etc.) move to a `@app/aether-canvas-shared`
sub-package that both web + native import."

Round AK is that move (minus `linearFogDensity` + the visual
primitives — they live in `packages/aether-canvas/src/` and depend
on R3F so they don't fit `canvas-shared`).

## Workflow scaffolding

Round AK was the first round to use multi-agent workflows:

1. **Discovery workflow** (6 parallel scouts + 1 synthesizer, 7
   agents, ~541k subagent tokens) produced the 15-slice punch list
   captured at the top of this doc.
2. **Implementation workflow** (8 parallel slice agents, ~506k
   subagent tokens) authored the polish + coverage slices in
   parallel. The main loop wrote the returned files, fixed three
   small issues (vitest ESM `require`, locale-dependent
   `toLocaleString`, jsdom `clip: rect(0px)` serialisation), and
   committed each slice.

## Operator-owed

- Push the AE453 → AE466 commit chain (11 commits this round + the
  Round AJ chain still unpushed).
- Approve Chromatic baselines for the 4 new Storybook stories
  (LumenPhotoSlot / LumenFocusAnnouncer / Phase1PulseOverlay /
  Phase1DevNav).
- Phase 4 decisions still pending (Tamagui-out / R3F-native vs Skia /
  single-binary) + EAS bootstrap before mobile code starts.

## See also

- [`16-round-aj-progress.md`](16-round-aj-progress.md) — Round AJ closeout
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`02-surfaces.md`](02-surfaces.md) — the ten experience pillars
- [`packages/aether-canvas-shared/`](../../packages/aether-canvas-shared/) — the new shared package
