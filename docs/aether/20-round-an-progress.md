# Round AN progress — Phase 3 barrel + canvas-shared invariants

> Round AN adds 2 substantive slices (AE488 + AE489) on top of Round AM.
> Both close gaps in the test scaffolding the Phase 4 native port will
> depend on:
>
> 1. **Phase 3 barrel + shape-gate (AE488)** — Phase 3 historically had
>    no `index.ts` barrel (echo + mirror + live-trip-watch were imported
>    per-file). The new barrel matches Phase 1 + Phase 2 and gets a
>    paired shape-gate spec. Three layers of shape-gate now cover the
>    entire Phase 1/2/3 web surface.
> 2. **Invariant spec for canvas-shared (AE489)** — pins mathematical
>    LAWS (sphere-surface invariant for `latLngToVec3`, unit-vector
>    invariant for `bearingToVec3`, monotonicity for `easedPhaseProgress`,
>    bounds for `pulseBreathAt`, etc.) that the Phase 4 native port
>    must reproduce. 21 invariants across 9 describe blocks.

## Slice inventory

| Slice | Title                                                 | Files                                                                                                    | Tests added |
| ----- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| AE488 | Phase 3 barrel + API surface shape-gate               | `apps/web/src/components/aether/phase3/index.ts` + `apps/web/test/lib/aether-phase3-api-surface.spec.ts` | +~45        |
| AE489 | Geometric + numeric invariants spec for canvas-shared | `packages/aether-canvas-shared/test/invariants.spec.ts`                                                  | +21         |
| AE490 | Round AN closeout doc + PROGRESS.md                   | `docs/aether/20-round-an-progress.md` + README + PROGRESS                                                | n/a         |

## Test bar

- `pnpm --filter web typecheck`: clean ✓
- `pnpm --filter @app/aether-canvas-shared test` (jest): 12 → 33 (+21 invariants); 33/33 ✓
- `pnpm --filter web test` (vitest): + ~45 from AE488

## Three-layer shape gate

After AE488, every web Aether surface barrel has a paired shape-gate
spec:

| Layer      | Spec                                                     | Coverage                                      |
| ---------- | -------------------------------------------------------- | --------------------------------------------- |
| Shared pkg | `packages/aether-canvas-shared/test/index-shape.spec.ts` | 35 modules in 12 describe blocks (AE481)      |
| Phase 1    | `apps/web/test/lib/aether-phase1-api-surface.spec.ts`    | ~70 exports across 11 describe blocks (AE483) |
| Phase 2    | `apps/web/test/lib/aether-phase2-api-surface.spec.ts`    | ~30 exports across 5 describe blocks (AE484)  |
| Phase 3    | `apps/web/test/lib/aether-phase3-api-surface.spec.ts`    | ~45 exports across 4 describe blocks (AE488)  |

A rename in any barrel now fires a paired spec loudly. Phase 4 native
package authoring can re-export from `@app/aether-canvas-shared` with
the same name + see the shape-gate green confirm the contract.

## What the invariants spec (AE489) adds

The apps/web tests verify behaviour at the consumer level ("the button
shows 'Plan'", "the overlay tier flips to 'live'", etc.). The
invariants spec inside canvas-shared pins the MATHEMATICAL laws
underneath each helper — properties that must hold for every input,
not just the curated cases.

Sample of pinned invariants:

- **Compass rose**: `bearingToVec3` returns a unit vector for every
  degree in [0, 360). `CARDINALS` is the canonical N/E/S/W list.
- **Mirror globe**: `latLngToVec3(lat, lng, r)` always satisfies
  `|v| === r` (8 sample points from the equator + poles + dateline).
  `sosDotRadius` is monotonic in severity 1..5. `scamClusterRadius`
  caps at 0.5 for very large counts.
- **Vault glyph-ring**: every glyph position sits at exact distance
  `r` from the origin (verified for totals 1..12).
- **Lifecycle progress**: `easedPhaseProgress` is monotonically
  non-decreasing across a phase. `easeOutCubic` stays in [0, 1].
  `cameraPoseAt` returns finite Vec3 tuples for every phase.
- **Pulse breathing**: scale + opacity stay within the mood envelope
  across the full t-range for every mood.
- **Echo card layout**: active card always has `(y, scale, opacity)
=== (0, 1, 1)`. Opacity drops monotonically as offset grows.
- **Time + presence**: `timeBandFor` partitions all 24 hours into
  exactly 4 bands. `presenceFreshness` covers live / recent / stale
  for a fixed clock.

Each invariant maps to a Phase 4 native port concern. A single
off-by-one in the migrated math would fail one of these checks
loudly — without needing apps/web to be set up.

## Operator-owed

- Push the AE488 → AE490 commit chain (3 commits this round + the
  still-unpushed Round AJ-AM history). ~40 unpushed commits total.
- Three Phase 4 decisions still pending (Tamagui-out / R3F-native vs
  Skia / single-binary) + EAS bootstrap before mobile code starts.

## See also

- [`19-round-am-progress.md`](19-round-am-progress.md) — Round AM closeout
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`08-data-flow.md`](08-data-flow.md) §8 — canvas-shared inventory diagram
- [`09-component-catalog.md`](09-component-catalog.md) — canvas-shared bucket map
