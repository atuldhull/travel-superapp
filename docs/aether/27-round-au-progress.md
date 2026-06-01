# Round AU progress — second Aether mobile surface + reduced-motion

> Round AU ports the **Continuum handoff sigil** as the second Aether
> mobile surface (Skia), adds the pure layout helper it needs to
> canvas-shared, and wires OS Reduce Motion detection into the Pulse
> glow. Two of ten surfaces now render on mobile; both Skia; both
> driven by canvas-shared pure math.

## Workflow

A single Workflow invocation (`round-au-continuum-sigil`) ran 8
agents in a parallel read → generate pipeline. The novel structure
this round: a **pre-agreed helper API** (`sigilCellRects` +
`sigilPixelSize` signatures) was passed verbatim to all three
generators in the script, so the helper impl, the Skia component (which
consumes the helper), and the spec all matched without a barrier
between them.

Outputs:

- The helper-generator agent wrote `sigil-render.ts` + its spec +
  the updated barrel directly (used its Write tool).
- The hook-generator agent wrote `use-reduced-motion-native.ts`
  directly.
- The component-generator returned `continuum-sigil.tsx` in its
  structured output; main loop wrote it + patched 9 mojibake em-dashes
  in the JSDoc (the JSON round-trip through PowerShell 5.1's default
  encoding mangled them — same recovery as rounds AP/AQ).

All verification passed: canvas-shared jest 690 → 725 (+35),
apps/mobile typecheck clean.

## Slice inventory

| Slice | Title                                                  | Files                                                                                          |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| AE530 | canvas-shared `sigil-render` layout helper + spec      | `packages/aether-canvas-shared/src/sigil-render.ts` + `test/sigil-render.spec.ts` + `index.ts` |
| AE531 | `<AetherContinuumSigil/>` Skia component               | `apps/mobile/src/aether/continuum-sigil.tsx`                                                   |
| AE532 | `useReducedMotionNative` hook + thread into Pulse glow | `apps/mobile/lib/use-reduced-motion-native.ts` + `apps/mobile/app/_layout.tsx`                 |
| AE533 | Round AU closeout doc + PROGRESS catch-up              | `docs/aether/27-round-au-progress.md` + README + PROGRESS                                      |

## Test bar

- `@app/aether-canvas-shared` jest: **690 → 725** (+35, AE530 spec)
- `apps/mobile` typecheck: **clean** ✓
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE530 adds

`sigilCellRects(grid, cellPx, gapPx?)` lays a `SigilGrid` (the
boolean[][] from `buildSigilGrid`) into positioned square cells in
row-major order. `sigilPixelSize(grid, cellPx, gapPx?)` returns the
total square edge. Both are pure — the web SVG renderer + the mobile
Skia renderer share the exact layout math, so a sigil is byte-identical
across devices during handoff (`sigilEquals` already pinned the grid
invariant; AE530 extends that to the pixel layout).

The 35-test spec covers empty/1x1/2x2-mixed grids, gapPx stride math,
pixel-size for 1/3-col + with-gap, and integration with the real
`buildSigilGrid` (rect count == cell count, filled-rect count ==
`sigilFilledCount`, the default 21x21 lays out 441 rects).

## What AE531 adds

`<AetherContinuumSigil seed={...} />` is the second Aether mobile
surface. It paints the filled cells of `buildSigilGrid(seed, size)` as
Skia `<Rect>`s positioned by AE530's helper. Static (no animation, no
timers) — the sigil is a fixed identifier, recomputed only when its
`(seed, size, cellPx, gapPx)` tuple changes. Sizes itself to
`sigilPixelSize` so the parent lays it out blind to the grid
dimensions. Default 21x21 grid at 6px cells + 1px gaps = ~146px square.

Not yet mounted in a route — it lands wherever the Continuum
popover/sheet ports (a future round). AE531 ships the component +
its contract.

## What AE532 adds

`useReducedMotionNative()` is the native analog of the web's
`prefers-reduced-motion` media query. It reads
`AccessibilityInfo.isReduceMotionEnabled()` at mount, subscribes to
`'reduceMotionChanged'`, and cleans up on unmount. Threaded into
`app/_layout.tsx` so `<AetherPulseGlow reducedMotion={...} />` collapses
its breathing loop to a static envelope when the user has Reduce
Motion enabled — honouring locked decision #4 (audio + motion respect
OS accessibility settings). This is the canonical feed every future
surface's `reducedMotion` prop threads.

## Coverage state after AU

**Surfaces shipped on mobile:** 2 / 10 (Pulse + Continuum sigil).
Continuum's sigil component exists but isn't route-mounted yet.

| Surface   | Renderer | Status               |
| --------- | -------- | -------------------- |
| Pulse     | Skia     | ✅ live (AE526-527)  |
| Continuum | Skia     | ✅ component (AE531) |
| Drift     | R3F      | ⏳ next              |
| Atlas     | R3F      | ⏳                   |
| Compass   | R3F      | ⏳                   |
| Lumen     | R3F      | ⏳                   |
| Genie     | R3F      | ⏳                   |
| Vault     | R3F      | ⏳                   |
| Echo      | R3F      | ⏳                   |
| Mirror    | Skia     | ⏳                   |

The two easy Skia surfaces (Pulse, Continuum) are now done. The next
surface (Drift) is the first **R3F-native** port — it requires
installing `expo-three` + `@react-three/fiber/native` and mounting a
real `<Canvas>` 3D scene, a heavier slice.

## Operator-owed (unchanged + extended)

- Push the AE530 → AE533 chain (4 commits this round) + the still-
  unpushed AJ-AT history. **~87 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- Validate Pulse + Continuum sigil on real hardware once EAS is up.

## Next round candidates

1. **Drift mobile** (R3F-native) — first 3D surface. Install
   `expo-three` + `@react-three/fiber/native`, mount `<Canvas>` with
   a SunDisk + AmbientField. Heaviest plumbing slice of Phase 4 so
   far.
2. **Mount the Continuum sigil in a route** — wire it into a handoff
   sheet (small slice).
3. **`@app/aether-core-native` consumed by apps/mobile** — derive
   Pulse mood from the surface lifecycle instead of a static prop.

## See also

- [`26-round-at-progress.md`](26-round-at-progress.md) — Round AT (first mobile surface, Pulse)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
