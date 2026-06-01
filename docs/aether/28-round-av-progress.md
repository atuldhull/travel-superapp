# Round AV progress — Drift, the first R3F-native mobile surface

> Round AV is the inflection point of Phase 4: the **first
> R3F-native surface** (Drift) lands on mobile, proving the
> expo-three + `@react-three/fiber/native` path that 7 of the 10
> surfaces depend on. The first two surfaces (Pulse, Continuum)
> were Skia; Drift is the first 3D `<Canvas>`. apps/mobile
> typecheck stays clean throughout.

## Slice inventory

| Slice | Title                                                             | Files                                                                                                |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AE534 | Install R3F-native stack (three + fiber@8 + expo-gl + expo-three) | `apps/mobile/{package.json, pnpm-lock.yaml}`                                                         |
| AE535 | canvas-shared Drift ambient-field + sun-disk math + spec          | `packages/aether-canvas-shared/src/drift-field.ts` + `test/drift-field.spec.ts` + `index.ts`         |
| AE536 | `<AetherDriftScene/>` R3F-native scene                            | `apps/mobile/src/aether/drift-scene.tsx`                                                             |
| AE537 | `/aether/drift` route + gated explore entry point + env typings   | `apps/mobile/app/aether/drift.tsx` + `app/_layout.tsx` + `app/(tabs)/explore.tsx` + `types/env.d.ts` |
| AE538 | Round AV closeout doc + PROGRESS catch-up                         | `docs/aether/28-round-av-progress.md` + README + PROGRESS                                            |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (with the full R3F-native stack
  installed + the 3D scene + the route)
- `@app/aether-canvas-shared` jest: **725 → 745** (+20, AE535 spec)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE534 installed

The React-18-compatible R3F-native stack, pinned to Expo 51 / RN 0.74:

- `three@0.168.0`
- `@react-three/fiber@8.18.0` — the **v8 line** supports React 18; v9
  needs React 19, which waits on an Expo 52 upgrade.
- `expo-gl@14.0.2` — the Expo-51-matched GL view that fiber/native
  renders into.
- `expo-three@8.0.0`
- `@types/three@0.168.0` (dev)

The peer warnings (expo-three wants three@^0.166 vs 0.168;
@expo/browser-polyfill's stale react@17 / file-system@13 peers) are
benign — 0.168 is API-compatible and the polyfill peers are
historical.

## What AE535 added

Pure Drift geometry in canvas-shared so the web R3F `<AmbientField>` +
`<SunDisk>` and the native scene lay out identically:

- `ambientFieldPositions(count, bounds?, seed?)` — deterministic
  `[x,y,z]` tuples via a mulberry32 PRNG (same seed → same cloud).
- `ambientFieldPositionArray(...)` — the same cloud flattened into a
  `Float32Array` ready for a Three.js `BufferAttribute`.
- `sunDiskRotation(tMs, radiansPerSecond?)` — rotation angle folded
  into `[0, 2π)`; slow default of one turn per ~50s.
- `DEFAULT_DRIFT_BOUNDS / MOTE_COUNT (600) / SEED / SUN_RADIANS_PER_SECOND`.

20-test spec pins determinism, bounds containment, count edge cases,
the Float32 flatten shape, and rotation wrap/period/non-finite.

## What AE536 added — the first R3F-native scene

`<AetherDriftScene/>` mounts a real `@react-three/fiber/native`
`<Canvas>`:

- **SunDisk**: a slow-rotating terracotta `<circleGeometry>` mesh, the
  rotation driven by `sunDiskRotation(elapsed)` via `useFrame`. Frozen
  when `reducedMotion` is set.
- **AmbientField**: a ~600-mote ochre dust cloud as a single
  `<points>`, positions built once from `ambientFieldPositionArray`
  into a `<bufferAttribute>`.
- Camera mounts at `cameraPoseAt('idle')` — the shared hero pose.

The R3F-native JSX intrinsics (`mesh`, `circleGeometry`, `points`,
`bufferGeometry`, `bufferAttribute`, `pointsMaterial`, `color`,
`ambientLight`) all resolve through `@react-three/fiber`'s type
augmentation — apps/mobile typecheck clean **on the first run**, no
shims needed. Runtime validation awaits an EAS dev build on a device.

## What AE537 added — the route

- `app/aether/drift.tsx` — full-screen route, gated by
  `EXPO_PUBLIC_FEATURE_AETHER_PHASE1`. Flag off → calm "not enabled"
  notice (so production never surfaces unfinished work). Threads
  `useReducedMotionNative` into the scene.
- A gated "Aether preview: open Drift" banner in the explore tab links
  to it via expo-router `Link`.
- `types/env.d.ts` — ambient typings for the `EXPO_PUBLIC_*` vars so
  `process.env.EXPO_PUBLIC_*` typechecks without dragging in
  `@types/node` (which would wrongly surface Node globals in RN).

## Coverage state after AV

**Surfaces shipped on mobile:** 3 / 10.

| Surface   | Renderer | Status                        |
| --------- | -------- | ----------------------------- |
| Pulse     | Skia     | ✅ live + mounted (AE526-527) |
| Continuum | Skia     | ✅ component (AE531)          |
| Drift     | R3F      | ✅ live + routed (AE534-537)  |
| Atlas     | R3F      | ⏳ next                       |
| Compass   | R3F      | ⏳                            |
| Lumen     | R3F      | ⏳                            |
| Genie     | R3F      | ⏳                            |
| Vault     | R3F      | ⏳                            |
| Echo      | R3F      | ⏳                            |
| Mirror    | Skia     | ⏳                            |

**Both renderer paths are now proven** (Skia via Pulse/Continuum, R3F
via Drift). The remaining 6 R3F surfaces + 1 Skia surface follow the
established patterns; each reuses canvas-shared math + the proven
mount shape.

## Operator-owed

- Push the AE534 → AE538 chain (5 commits this round) + the still-
  unpushed AJ-AU history. **~92 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate Drift on a device.** The scene typechecks but R3F-native
  - expo-gl runtime behaviour (GL context init, frame timing, the
    points cloud render) can only be confirmed in an EAS dev build —
    it's the first time the 3D path actually runs.

## Next round candidates

1. **Atlas mobile** (R3F-native) — the heaviest surface (trip studio +
   PlaceOrb physics + draggable timeline). Likely multi-round. Reuses
   the canvas-shared atlas-orbs layout math (already spec'd, AE509).
2. **Mount the Continuum sigil in a handoff route** — small slice, but
   gives Continuum a live route like Drift now has.
3. **`@app/aether-core-native` consumed by apps/mobile** — derive the
   Pulse mood + Drift burst from the surface lifecycle instead of
   static props. Carries the React-18/19 @types risk we mitigated for
   canvas-shared; may need the same inlining treatment.

## See also

- [`27-round-au-progress.md`](27-round-au-progress.md) — Round AU (Continuum sigil)
- [`26-round-at-progress.md`](26-round-at-progress.md) — Round AT (first mobile surface, Pulse)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
