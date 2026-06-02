# Round AX progress — two surfaces in one round (Compass + Vault)

> Round AX is a 2x round: **two** R3F-native surfaces ported in one
> pass — Compass (the bird-mode rose) and Vault (the floating
> price-glyph ring) — each with a live route. Six of ten surfaces now
> render on mobile. apps/mobile typecheck stays clean; both scenes
> typechecked first-try against the three/fiber types.

## Slice inventory

| Slice | Title                                                       | Files                                                                       |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| AE543 | `<AetherCompassScene/>` R3F-native bird-mode rose           | `apps/mobile/src/aether/compass-scene.tsx`                                  |
| AE544 | `/aether/compass` route + Compass/Vault explore links + nav | `apps/mobile/app/aether/compass.tsx` + `_layout.tsx` + `(tabs)/explore.tsx` |
| AE545 | `<AetherVaultScene/>` R3F-native price-glyph ring           | `apps/mobile/src/aether/vault-scene.tsx`                                    |
| AE546 | `/aether/vault` route                                       | `apps/mobile/app/aether/vault.tsx`                                          |
| AE547 | Round AX closeout doc + PROGRESS catch-up                   | `docs/aether/30-round-ax-progress.md` + README + PROGRESS                   |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (two new R3F scenes + two routes)
- `@app/aether-canvas-shared` jest: still 745 ✓ (both surfaces reuse
  already-spec'd math — compass-rose AE489 + vault-glyphs AE511)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE543 added — Compass

`<AetherCompassScene/>` is the bird-mode rose (eye-mode AR stays
deferred to Phase 5 per decision #8). Geometry from
`bearingPositionOnRing` + `CARDINALS` + `normalizeBearing`
(canvas-shared AE456, pinned by the AE489 unit-vector invariants):

- an olive `<torusGeometry>` ring (the rose outline)
- 4 cardinal markers at their bearings — North terracotta + emissive,
  the rest cream
- a needle: a group rotated by the heading (`rotation.y` maps +Z onto
  the bearing) holding a cream bar + a terracotta cone tip at the north
  end + an olive centre hub

Camera looks down from `[0, 4.5, 4.5]` so the ring reads top-down.
Ships a self-sweeping demo heading (frozen under `reducedMotion`); an
optional `headingDegrees` prop pins it. Real device heading via
expo-location lands later.

## What AE545 added — Vault

`<AetherVaultScene/>` is the floating price-glyph ring (the 3D part of
the booking surface; the Stripe checkout panel ports later). Geometry +
weighting from `glyphRingPosition` + `glyphFloatY` + `glyphSphereScale`

- `glyphHaloIntensity` (canvas-shared AE407, pinned by AE489 radius
  invariants + spec'd at AE511), rendering the shared `SAMPLE_VAULT_PRICES`
  catalogue (AE414, AE500):

* each glyph sits at `glyphRingPosition(i, total)`
* bobs vertically via `glyphFloatY(i, t)` (phase-shifted per glyph so
  they don't move as a block)
* is sized by `glyphSphereScale(amount, min, max)` so cheaper deals
  read smaller
* glows terracotta (raised emissive) when its price dropped recently,
  via `glyphHaloIntensity(priceDroppedRecently(history))`

The whole ring turns slowly. All animation frozen under `reducedMotion`.

## Routes

`/aether/compass` (AE544) + `/aether/vault` (AE546) join the existing
`/aether/{drift,atlas,continuum}`. The explore-tab "Aether preview"
section now lists all five non-overlay surfaces; Pulse stays the
always-present overlay.

## Coverage state after AX

**Surfaces shipped on mobile:** 6 / 10.

| Surface   | Renderer | Status                        |
| --------- | -------- | ----------------------------- |
| Pulse     | Skia     | ✅ live overlay (AE526-527)   |
| Continuum | Skia     | ✅ live route (AE531 + AE541) |
| Drift     | R3F      | ✅ live route (AE534-537)     |
| Atlas     | R3F      | ✅ live route (AE539-540)     |
| Compass   | R3F      | ✅ live route (AE543-544)     |
| Vault     | R3F      | ✅ live route (AE545-546)     |
| Lumen     | R3F      | ⏳ next                       |
| Genie     | R3F      | ⏳                            |
| Echo      | R3F      | ⏳                            |
| Mirror    | Skia     | ⏳                            |

Four R3F surfaces + two Skia surfaces are live. The remaining four
(Lumen, Genie, Echo R3F; Mirror Skia) follow the same shape: a scene
component reading canvas-shared math (all already extracted + spec'd) +
a flag-gated route.

## Why two surfaces in one round was safe

Compass + Vault are independent of each other and of any SDK data
(Compass takes a heading; Vault uses the shared sample catalogue). Both
reuse canvas-shared math that's already pinned by the AE489 invariants

- behavioural specs — so the only new code is the R3F mount, which the
  Drift + Atlas rounds already proved hand-writes cleanly. Both scenes
  typechecked on the first run.

## Operator-owed

- Push the AE543 → AE547 chain (5 commits this round) + the still-
  unpushed AJ-AW history. **~101 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate the four R3F surfaces on a device** (Drift, Atlas,
  Compass, Vault). All typecheck; none have rendered — the GL runtime
  needs an EAS dev build.

## Next round candidates

1. **Lumen mobile** (R3F) — the photo cloud. Reuses `layoutPhotoCloud`
   - the lumen-strategies layouts (spec'd AE507 / AE508). The wrinkle
     is texture loading via Expo Asset; first cut can use solid-colour
     planes.
2. **Echo mobile** (R3F or RN FlatList) — the vertical social feed.
   Reuses echo-layout + echo-feed (spec'd AE503).
3. **Mirror mobile** (Skia) — the last Skia surface; admin forensics
   minus the audit-river overlay.
4. **Surface depth** — Atlas tap-to-focus, Vault tap-to-checkout, real
   Compass heading. Builds interaction depth rather than breadth.

## See also

- [`29-round-aw-progress.md`](29-round-aw-progress.md) — Round AW (Atlas + routing)
- [`28-round-av-progress.md`](28-round-av-progress.md) — Round AV (Drift, first R3F-native)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
