# Round AW progress — Atlas (second R3F surface) + every surface routed

> Round AW ports **Atlas** as the second R3F-native surface (the trip
> studio) and gives all three `/aether/*` surfaces live routes with an
> "Aether preview" section in the explore tab. Four of ten surfaces
> now render on mobile; both renderer paths exercised by multiple
> surfaces each. apps/mobile typecheck stays clean.

## Slice inventory

| Slice | Title                                                             | Files                                                                                                   |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| AE539 | `<AetherAtlasScene/>` R3F-native orb scene                        | `apps/mobile/src/aether/atlas-scene.tsx`                                                                |
| AE540 | `/aether/atlas` route + SAMPLE_LEH_TRIP fixture + explore section | `apps/mobile/app/aether/atlas.tsx` + `src/aether/sample-trip.ts` + `_layout.tsx` + `(tabs)/explore.tsx` |
| AE541 | `/aether/continuum` route (Continuum sigil gets a live route)     | `apps/mobile/app/aether/continuum.tsx`                                                                  |
| AE542 | Round AW closeout doc + PROGRESS catch-up                         | `docs/aether/29-round-aw-progress.md` + README + PROGRESS                                               |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (second R3F scene + 2 new routes)
- `@app/aether-canvas-shared` jest: still 745 ✓ (no canvas-shared changes this round)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE539 added — the Atlas scene

`<AetherAtlasScene days={...} />` is the native R3F port of the web
Atlas Phase 1 scene. It mounts a real `@react-three/fiber/native`
`<Canvas>` and renders:

- one ochre `<sphereGeometry>` orb per itinerary item, positioned by
  `layoutOrbsForTrip` (canvas-shared AE456, spec'd AE509)
- an olive day-marker tick (`<boxGeometry>`) under each day along the
  timeline, from `layoutDayMarkers`
- a gentle whole-field idle rotation (one turn / 90s), frozen under
  `reducedMotion`

Per-orb size + colour come from `orbSizeForItem` / `orbColorForItem`.
The web R3F Atlas + this native scene place orbs at identical world
coordinates because they share the exact same layout math.

**Not yet ported** (later slices): PlaceOrb drag physics, the
draggable timeline, tap-to-focus, the per-orb place card. AE539 proves
the Atlas scene renders from real itinerary data.

## What AE540 + AE541 added — routes

All three non-overlay surfaces now have live routes behind the feature
flag:

- `/aether/drift` (AE537) — the home field
- `/aether/atlas` (AE540) — the trip studio, rendering the
  `SAMPLE_LEH_TRIP` fixture (4 days, 10 items, exercises multi-item
  day stacking)
- `/aether/continuum` (AE541) — the handoff sigil for a sample
  cross-device deep link + the link itself, with the seed from
  `continuumSigilSeed(state)`

The explore tab's single Drift banner became an **"Aether preview"**
section listing all three, each a `Link` to its route. Pulse remains
the always-present overlay (mounted in `_layout.tsx`, no route of its
own).

`src/aether/sample-trip.ts` holds the shared 4-day Leh fixture
(`AtlasDayLike[]`) so the preview routes demo on a fresh install
without an account. Dropped once the routes wire to a real trip via
`useTripControllerGetItinerary`.

## Coverage state after AW

**Surfaces shipped on mobile:** 4 / 10.

| Surface   | Renderer | Status                        |
| --------- | -------- | ----------------------------- |
| Pulse     | Skia     | ✅ live overlay (AE526-527)   |
| Continuum | Skia     | ✅ live route (AE531 + AE541) |
| Drift     | R3F      | ✅ live route (AE534-537)     |
| Atlas     | R3F      | ✅ live route (AE539-540)     |
| Compass   | R3F      | ⏳ next                       |
| Lumen     | R3F      | ⏳                            |
| Genie     | R3F      | ⏳                            |
| Vault     | R3F      | ⏳                            |
| Echo      | R3F      | ⏳                            |
| Mirror    | Skia     | ⏳                            |

Both renderer paths now carry **two surfaces each** (Skia: Pulse +
Continuum; R3F: Drift + Atlas). The remaining surfaces follow the
established mount shape — a scene component reading canvas-shared math +
a flag-gated route.

## Operator-owed

- Push the AE539 → AE542 chain (4 commits this round) + the still-
  unpushed AJ-AV history. **~96 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate Drift + Atlas on a device.** Both R3F scenes typecheck
  but the GL runtime (context init, the orb-cloud render, frame
  timing) needs an EAS dev build to confirm.

## Next round candidates

1. **Compass mobile** (R3F-native) — the bird-mode rose. Reuses the
   canvas-shared compass-rose math (`bearingToVec3`, `CARDINALS`,
   already pinned by AE489 invariants). Medium slice.
2. **Atlas interactions** — tap-to-focus an orb + the per-orb place
   card. Builds depth on the Atlas surface rather than breadth.
3. **`@app/aether-core-native` consumed by apps/mobile** — derive
   surface mood/lifecycle from the manager rather than static props.
   Carries the React-18/19 `@types` risk; may need the canvas-shared
   inlining treatment.

## See also

- [`28-round-av-progress.md`](28-round-av-progress.md) — Round AV (Drift, first R3F-native)
- [`27-round-au-progress.md`](27-round-au-progress.md) — Round AU (Continuum sigil)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
