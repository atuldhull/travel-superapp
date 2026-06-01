# Round AJ progress — Phase 4 prep + Phase 2/3 polish

> Round AJ adds 21 slices (AE431 → AE451) layered on top of the
> [Phase 3 closeout](14-phase3-closeout.md). No new surfaces — the
> round focuses on three buckets that close coverage gaps before
> the Phase 4 mobile port starts:
>
> 1. **jsdom integration specs** for the Phase 2 + Phase 3 components
>    that previously only had pure-helper unit coverage.
> 2. **Storybook variants** for the Phase 2 components (Lumen / Genie /
>    Vault) and two Phase 1 overlays (DriftNowCard / ContinuumBar).
> 3. **Pure helper extractions** and edge-case spec sweeps anchored
>    on math the Phase 4 native port will need to reproduce verbatim
>    (palette slot names, presence age formatting, R3F ring math,
>    gesture FSM, audit-river TTL, MIME-to-extension).
> 4. **Pre-hydrate skeletons** for the last two `/aether` routes still
>    missing a `loading.tsx`.

## Slice inventory

| Slice | Title                                                                          | Files                                                                                              | Tests added            |
| ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------- |
| AE431 | jsdom integration spec for `<LumenArrangeMenu/>`                               | `lumen-arrange-menu-integration.spec.tsx`                                                          | +7                     |
| AE432 | jsdom integration spec for `<VaultCheckoutPanel/>`                             | `vault-checkout-panel-integration.spec.tsx`                                                        | +11                    |
| AE433 | jsdom integration spec for `<GenieDissolveOverlay/>`                           | `genie-dissolve-overlay-integration.spec.tsx`                                                      | +10                    |
| AE434 | jsdom integration spec for `<LiveTripWatchOverlay/>`                           | `live-trip-watch-overlay-integration.spec.tsx`                                                     | +11                    |
| AE435 | Storybook for `<LumenArrangeMenu/>`                                            | `LumenArrangeMenu.stories.tsx`                                                                     | n/a (5 variants)       |
| AE436 | Storybook for `<VaultCheckoutPanel/>`                                          | `VaultCheckoutPanel.stories.tsx`                                                                   | n/a (5 variants)       |
| AE437 | Storybook for `<GenieDissolveOverlay/>`                                        | `GenieDissolveOverlay.stories.tsx`                                                                 | n/a (5 variants)       |
| AE438 | Storybook for Genie capture-mode toggle                                        | `GenieCaptureModeToggle.stories.tsx`                                                               | n/a (3 variants)       |
| AE439 | Storybook for Genie recorder status row                                        | `GenieRecorderStatusRow.stories.tsx`                                                               | n/a (6 variants)       |
| AE440 | Extract `presenceAgoLabel` + 6 specs                                           | `live-trip-watch.ts`, `live-trip-watch.spec.ts`                                                    | +6                     |
| AE441 | Extract `paletteSlotName` + `paletteSlotIndex` + `PALETTE_SLOT_NAMES`          | `packages/aether-core/src/surface/palette.ts`, `packages/aether-core/test/surface/palette.spec.ts` | +7 (jest, aether-core) |
| AE442 | Edge-case specs for `boostHexColor`                                            | `echo-feed.spec.ts`                                                                                | +9                     |
| AE443 | Edge-case specs for `museumArcPositions`                                       | `lumen-museum.spec.ts`                                                                             | +9                     |
| AE444 | Edge-case specs for `glyphRingPosition` + `glyphFloatY`                        | `vault-glyph-positions.spec.ts`                                                                    | +13                    |
| AE445 | Edge-case specs for `liveAuditRows` + `auditRowYProgress`                      | `mirror-globe.spec.ts`                                                                             | +8                     |
| AE446 | Edge-case specs for `pulseReleaseOutcome` + `isHoldGesture` + `nextHoldStatus` | `pulse-hold-to-talk.spec.ts`                                                                       | +16                    |
| AE447 | `/aether/feed/loading.tsx` skeleton                                            | `apps/web/src/app/aether/feed/loading.tsx`                                                         | n/a                    |
| AE448 | `/aether/mirror/loading.tsx` skeleton                                          | `apps/web/src/app/aether/mirror/loading.tsx`                                                       | n/a                    |
| AE449 | Storybook for `<DriftNowCard/>` (Phase 1 overlay)                              | `DriftNowCard.stories.tsx`                                                                         | n/a (4 variants)       |
| AE450 | Storybook for `<ContinuumBar/>` (Phase 1 overlay)                              | `ContinuumBar.stories.tsx`                                                                         | n/a (3 variants)       |
| AE451 | Extract `genieMimeExtension` + 8 specs                                         | `genie-recorder.ts`, `genie-recorder.spec.ts`                                                      | +8                     |

Total: 108 new web vitest specs + 7 new aether-core jest specs + 9
new Storybook story files (38 variants).

## Test bar

- `pnpm --filter web test --run` (vitest): **2208 → 2316** (+108)
- `pnpm --filter @app/aether-core test`: 122 → 129 (+7)
- `pnpm --filter aether-storybook typecheck`: clean
- `pnpm --filter web typecheck`: clean

## Routes still 200

- `/aether/feed` (now with `loading.tsx` pre-hydrate)
- `/aether/mirror` (now with `loading.tsx` pre-hydrate)
- `/aether/{drift,atlas,journey/test,memory/test,vault}` (unchanged)

## What this round explicitly is NOT

- **Not a Phase 4 implementation start.** The Phase 4 plan locked
  in [`15-phase4-plan.md`](15-phase4-plan.md) still needs the three
  decisions (Tamagui-out / R3F-native vs Skia / single-binary) +
  operator-owed EAS bootstrap before any `apps/mobile/` work begins.
- **Not a new surface.** All ten surfaces from `02-surfaces.md` were
  scaffolded by the end of Phase 3.
- **Not a b-slice landing.** The backend b-slices owed from Phase 2
  - Phase 3 (Whisper STT / CLIP / ML-Kit / Stripe / WebTransport
    feed + presence / live admin SDK / Meilisearch) are still owed.

## Why these slices

The Phase 4 native port will need to reproduce a handful of
mathematical contracts exactly: the museum-arc geometry, the
vault-ring positions, the audit-river TTL window, the gesture FSM
thresholds, the palette slot order. The Phase 4 plan calls for
moving the pure helpers behind a `@app/aether-canvas-shared` (web +
native consumers); a wide spec bar today means the move can ship
as a pure refactor with no behavioural risk.

Storybook variants for the Phase 2 components close a Chromatic
coverage gap — Lumen / Genie / Vault landed without baselines, so
a future native parity diff (Chromatic + Maestro side-by-side)
would have had nothing to compare against.

The integration specs unlock more aggressive refactors in those
components (loop unrolls, prop renames, internal state restructures)
because the contract is now pinned at the render-output level, not
just the helper-return level.

## Operator-owed

- Push the AE431 → AE451 commit chain (21 commits this round, ~70+
  unpushed total across Phases 1-3).
- Approve a Storybook Chromatic baseline run so the 9 new story
  files lock visual diffs for the next round.
- Three Phase 4 decisions (Tamagui-out, R3F-native vs Skia,
  single-binary) before Phase 4 work begins.

## See also

- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`14-phase3-closeout.md`](14-phase3-closeout.md) — Phase 3 closeout
- [`02-surfaces.md`](02-surfaces.md) — the ten experience pillars
- [`06-decisions.md`](06-decisions.md) — the 8 Phase 0 decisions
