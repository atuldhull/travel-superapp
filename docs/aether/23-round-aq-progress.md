# Round AQ progress — canvas-shared behavioural specs round 3

> Round AQ extends the workflow-driven push from Round AP. After AP,
> 12 of 35 canvas-shared modules had own behavioural specs. Round AQ
> adds 7 more, including the deepest math in the package
> (lifecycle-camera lerps, continuum-sigil QR-grid generator, lumen
> cloud + strategies + atlas-orbs layout math). 19 of 35 modules now
> have own behavioural specs inside the package.

## Workflow

A single Workflow invocation, `round-aq-canvas-shared-specs`, ran
14 agents (7 read + 7 generate) in a parallel pipeline. The
schema for the generate stage was slightly tighter than AP:

- It instructed agents to use the JS string-escape form (`'\\u25C6'`)
  for non-ASCII glyphs in `expect(...).toBe(...)` arguments, to
  avoid the mojibake we hit in Round AP.
- It demanded plain-ASCII inside test string literals.

That worked for 6 of 7 specs; one (vault-glyphs) still came back
with mojibaked em-dashes (`â€”` instead of `—`), patched by main
loop. Two other minor recoveries: `destination-coords` had four
over-reaching prototype-safety / numeric-coercion tests that
asserted out-of-contract behaviour (the helper signature is
`string | null | undefined` — calling with a number throws); they
were dropped. `vault-glyphs` priceDroppedRecently had one
mis-fixtured assertion (`[100, 50, 25, 99]` first=100 last=99 IS a
drop) that was rewritten with the right contrast pair.

## Slice inventory

| Slice | Title                               | File                                                            | Tests |
| ----- | ----------------------------------- | --------------------------------------------------------------- | ----- |
| AE505 | lifecycle-camera spec               | `packages/aether-canvas-shared/test/lifecycle-camera.spec.ts`   | +36   |
| AE506 | continuum-sigil spec                | `packages/aether-canvas-shared/test/continuum-sigil.spec.ts`    | +49   |
| AE507 | lumen-cloud spec                    | `packages/aether-canvas-shared/test/lumen-cloud.spec.ts`        | +48   |
| AE508 | lumen-strategies spec               | `packages/aether-canvas-shared/test/lumen-strategies.spec.ts`   | +45   |
| AE509 | atlas-orbs spec                     | `packages/aether-canvas-shared/test/atlas-orbs.spec.ts`         | +41   |
| AE510 | destination-coords spec             | `packages/aether-canvas-shared/test/destination-coords.spec.ts` | +34   |
| AE511 | vault-glyphs spec                   | `packages/aether-canvas-shared/test/vault-glyphs.spec.ts`       | +43   |
| AE512 | Round AQ closeout doc + PROGRESS.md | `docs/aether/23-round-aq-progress.md` + README + PROGRESS       | n/a   |

## Test bar

- `pnpm --filter @app/aether-canvas-shared test` (jest):
  - Before AQ: **394** passing across 14 specs
  - After AQ: **690** passing across 21 specs (**+296**)
- web typecheck: unchanged

## What each slice pins

### AE505 — lifecycle-camera (36 tests)

Scalar + Vec3 lerps across t=0 / t=1 / midpoint / extrapolation /
negative range, the `previousPoseFor` FSM cell-by-cell (idle,
materialising, settling, listening, dissolving), and
`cameraPoseAt` at phase entry, end-of-transient, mid-eased,
ambient wrap, and dissolving ease-in. Locks the
`DEFAULT_CAMERA_SCRIPT` poses (hero distance 6, materialise z=9,
dissolve z=10, both with +1.5 Y lift) by value.

### AE506 — continuum-sigil (49 tests)

The AE390 Continuum handoff sigil. `DEFAULT_SIGIL_SIZE` (21x21 QR
v1 footprint), `hashSeed` FNV-1a determinism + non-negative
32-bit range + case + order sensitivity, `buildSigilGrid` shape
across default size + custom sizes + the finder-threshold
boundary at size 9 + non-finite / sub-1 / fractional fallbacks.
Finder-pattern invariants at three corners (outer ring + centre
3x3), absence of finder at bottom-right, six clearSpacer
rectangles, row-6 + column-6 timing-strip alternation, density
bounded to 25-75%. `sigilFilledCount` + `sigilEquals` exhaustive.

### AE507 — lumen-cloud (48 tests)

`clampRating` collapses null/NaN/Infinity, clamps to [0,5].
`timeToX` + `ratingToY` map to [-axisLength/2, +axisLength/2],
with divide-by-zero guards and ISO-string parsing. `jitterZFor`
deterministic per-id z-jitter that scales linearly with range.
`layoutPhotoCloud` across empty + singleton + multi inputs:
earliest → -axisLength/2, latest → +axisLength/2, all-null
collapses to x=0, per-photo size + url passthrough.
`sortPhotosByTime` ascending with null-tail sink, tie-stable, no
in-place mutation. `DEFAULT_LUMEN_LAYOUT` frozen.

### AE508 — lumen-strategies (45 tests)

The AE410 Lumen layout strategy module. `LUMEN_LAYOUT_STRATEGIES`
tuple shape + freeze. `isStrategyImplemented` gate (mood not yet,
others yes). Every pure layout: grid (sqrt-N cols, centred, z=0),
golden-angle spiral (radius ∝ sqrt(i), 137.5°, disc bound), wall
(70% axis tight pack), mood stub delegates to `layoutPhotoCloud`.
`applyLayoutStrategy` dispatcher routes every branch correctly,
empty-photo-list edge cases for every strategy.

### AE509 — atlas-orbs (41 tests)

Atlas Phase 1 orb layout (AE456 / AE378). `DEFAULT_ATLAS_LAYOUT`
constants. `dayPositionOnAxis` distribution (zero/single/multi-day

- boundary indices + midpoint). `orbZForSlot` symmetric centring.
  `layoutOrbsForTrip` ordering by item position, slot clamping past
  `maxOrbsPerSlot`, multi-day Z-spread. `layoutDayMarkers` pairing.
  `orbSizeForItem` fixed at 0.18 world-units. `orbColorForItem`
  themeAccent passthrough.

### AE510 — destination-coords (34 tests)

Curated destination → lat/lng/timezone lookup table. Case-
insensitive slug normalisation. Four-arm guard (null / undefined
/ empty / non-curated → null). Every aliased lookup
(leh↔ladakh, jaipur, spiti, rishikesh, ...). Structural shape of
returned coords. `curatedCoordSlugs` determinism + canonical +
alias coverage, every returned slug resolves.

### AE511 — vault-glyphs (43 tests)

`glyphSize` + `glyphOpacity` linear interpolation across the
configured ranges, degenerate (max ≤ min) and non-finite amount
fallback to minimum, clamping outside the input range.
`formatMinorAmount` happy path via Intl currency formatting, the
em-dash sentinel for non-finite input, the bare-digit fallback
for rejected currency codes, minor → major unit conversion.
`priceSparkline` empty short-circuit, singleton midpoint,
multi-point with min→top + max→bottom (inverted SVG-y), flat
history flattens to height/2, custom layout config.
`priceDroppedRecently` first-vs-last comparison only.

## Coverage map after Round AQ

35 canvas-shared modules → **19** have own behavioural specs
inside the package (was 12 after AP, was 5 after AO).

The remaining 16:

- **Invariant-pinned via AE489**: compass-rose, vault-glyph-
  positions, lifecycle-progress, pulse-breathing, echo-layout,
  now-card-content (6).
- **Already covered by web-side specs at apps/web/test/lib/...**:
  lumen-selection, lumen-keyboard, genie-particles, genie-camera,
  mirror-investigate, live-trip-watch, now-card-lifecycle,
  upcoming-trip, continuum-landing, echo-feed (already done in AP
  also — has its own spec now). Pure helper-style modules with
  minimal new logic. ~10 remain.

A future Round AR could plausibly close another 5-7 by the same
pattern, leaving only the trivially-pure helpers without their own
spec.

## Workflow-output recovery patterns now established

Across rounds AP + AQ, recoveries on workflow-generated specs:

1. **Mojibake on non-ASCII glyphs** (round AP: mirror-globe `◆ • ⚠ ◉ ·`; round AQ: vault-glyphs `—`).
   Fix: `[char]0xNNNN` substitution via PowerShell. The AQ workflow
   prompt now requests `'\\u25C6'` string-escape form to prevent this,
   which worked for 6/7 specs.

2. **Over-reaching tests for out-of-contract input** (round AQ:
   destination-coords numeric coercion). Fix: drop the tests; the
   helper signature pins the contract.

3. **Mis-fixtured assertions** (round AQ: priceDroppedRecently
   `[100, 50, 25, 99]` first=100 last=99 IS a drop). Fix: rewrite
   the assertion with the right contrast pair.

All three recovery patterns are sub-minute fixes once the failure
shows in jest. The workflow + main-loop hybrid stays fast.

## Operator-owed (unchanged from AP)

- Push the AE505 → AE511 chain (8 commits this round + the still-
  unpushed AJ-AP history). ~65 unpushed commits total.
- Three Phase 4 decisions still pending (Tamagui-out / R3F-native
  vs Skia / single-binary) + EAS bootstrap.

## See also

- [`22-round-ap-progress.md`](22-round-ap-progress.md) — Round AP closeout
- [`21-round-ao-progress.md`](21-round-ao-progress.md) — Round AO closeout
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
