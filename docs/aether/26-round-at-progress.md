# Round AT progress — first Aether mobile surface live

> Round AT is the third slice of Phase 4 implementation: **first
> real Aether mobile surface mounted in apps/mobile.** A 64-px
> Skia corner glow now renders above every route, driven by the
> same `pulseBreathAt(mood, t)` math the web R3F Pulse uses.
> apps/mobile typecheck stays clean end-to-end.

## Slice inventory

| Slice | Title                                                                    | Files                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AE524 | Wire `@app/aether-canvas-shared` into apps/mobile                        | `apps/mobile/{package.json, tsconfig.json, pnpm-lock.yaml}`                                                                                                                                                                                   |
| AE525 | Install `@shopify/react-native-skia` v1.12.4 (Expo 51-compatible)        | `apps/mobile/{package.json, pnpm-lock.yaml}`                                                                                                                                                                                                  |
| AE526 | Build `<AetherPulseGlow/>` Skia component + 2 canvas-shared cleanups     | `apps/mobile/src/aether/pulse-glow.tsx`, `packages/aether-canvas-shared/src/{surface-lifecycle-phase.ts,index.ts,pulse-breathing.ts,lifecycle-camera.ts,lifecycle-progress.ts,now-card-lifecycle.ts,continuum-state.ts,continuum-landing.ts}` |
| AE527 | Mount `<AetherPulseGlow/>` in `apps/mobile/app/_layout.tsx`              | `apps/mobile/app/_layout.tsx`                                                                                                                                                                                                                 |
| AE528 | Operator scaffolding: eas.json env + .env.example + aether mobile README | `apps/mobile/{eas.json, .env.example, src/aether/README.md}`                                                                                                                                                                                  |
| AE529 | Round AT closeout doc + PROGRESS catch-up                                | `docs/aether/26-round-at-progress.md` + README + PROGRESS                                                                                                                                                                                     |

## Test bar

- `apps/mobile` typecheck (`pnpm typecheck` from `apps/mobile/`): **clean** ✓
- `@app/aether-canvas-shared` jest: still **690/690** ✓ (the AE526 cleanups didn't break a single spec)
- `@app/aether-{core,canvas,audio}-native` jest: still 6 + 10 + 15 = 31 ✓
- web typecheck: untouched + clean

## What AE526 actually does

`apps/mobile/src/aether/pulse-glow.tsx` is the first concrete
Aether mobile surface. Architecture:

1. Imports `pulseBreathAt(mood, t)` + `PulseMood` from
   `@app/aether-canvas-shared`. Same helper the web R3F Pulse FAB
   uses. Same numeric bounds (AE489 invariants).
2. Owns a `requestAnimationFrame` loop that drives `t` from
   mount-time. Future: replace with the surface manager clock once
   `@app/aether-core-native` is consumed by mobile so multiple
   mounts stay phase-locked.
3. Paints a `<Group>` of two `<Circle>`s in Skia:
   - Outer glow halo (`#E8B777` ochre, `r * 1.6`, half opacity).
   - Inner sphere (`#C2614A` terracotta, full opacity envelope).
4. Wraps in an absolutely-positioned `<View>` at the bottom-right
   corner with `pointerEvents='none'` so taps pass through to the
   routes beneath.
5. Honours a `reducedMotion?` prop — collapses to the static
   mid-range envelope when set.

The 64-px circle target + the 24-px margin from screen edges are
calibrated to keep Pulse clear of iOS / Android safe-area insets.

## What AE526 fixed in canvas-shared

Two surgical cleanups landed during the AE526 typecheck verification:

1. **Inlined `SurfaceLifecyclePhase`.** Canvas-shared previously did
   `import type { SurfaceLifecyclePhase } from '@app/aether-core'`
   in 4 files (pulse-breathing, lifecycle-camera, lifecycle-progress,
   now-card-lifecycle). That worked fine for web (React 19 @types)
   but transited through aether-core's React-19-JSX-using barrel
   when consumed by apps/mobile (React 18.2 @types), causing
   "ReactNode bigint" type clashes during mobile typecheck.

   The type is a plain 5-string union — no React, no DOM, no runtime
   — so we mirror it locally in `packages/aether-canvas-shared/src/
surface-lifecycle-phase.ts` and re-export from the barrel.
   Canvas-shared stays truly framework-free for native consumers.

2. **Replaced `URLSearchParams.entries()` with `.forEach((v, k) =>
...)`.** RN's TypeScript lib didn't carry the entries iterator
   in apps/mobile's setup; forEach is universally available across
   web + RN with identical behaviour. Two call sites:
   `continuum-state.ts` + `continuum-landing.ts`.

Both changes are behaviour-neutral. canvas-shared's 690 tests
all still pass.

## What AE527 mounted

```tsx
// apps/mobile/app/_layout.tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <PersistQueryClientProvider>
      <StatusBar />
      <Stack>{/* routes */}</Stack>
      <AetherPulseGlow /> {/* <-- AE527 */}
    </PersistQueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Mounted ABOVE the Stack so it persists across every screen.
`pointerEvents='none'` inside the component means it never blocks
taps on the routes beneath.

## What AE528 set up for the operator

- **eas.json** now ships `EXPO_PUBLIC_FEATURE_AETHER_PHASE1=1` in
  the development + preview build profiles so internal TestFlight
  cuts show the Aether surfaces. Production stays unset until
  surface ports are launch-ready.
- **apps/mobile/.env.example** documents every `EXPO_PUBLIC_*` var
  Phase 4 touches: feature flag, API base URL, WebTransport
  endpoints (for Continuum + live-trip-watch), Stripe key (for
  Vault), build SHA + time.
- **apps/mobile/src/aether/README.md** is the operator runbook —
  renderer policy, surface port order with Pulse marked done,
  wiring conventions (always import math from canvas-shared,
  reduced-motion prop, testID convention).

## Coverage state after AT

**Surfaces shipped on mobile:** 1 / 10 (Pulse).

**Phase 4 cross-cutting state:**

| Block                                                 | Status         |
| ----------------------------------------------------- | -------------- |
| 3 blocking decisions locked (AE513)                   | ✅             |
| `@app/aether-core-native` scaffolded (AE514)          | ✅             |
| `@app/aether-canvas-native` scaffolded (AE515)        | ✅             |
| `@app/aether-audio-native` scaffolded (AE516)         | ✅             |
| Tamagui stripped from apps/mobile (AE518-AE522)       | ✅             |
| `@app/aether-canvas-shared` consumed by apps/mobile   | ✅ AE524       |
| `@shopify/react-native-skia` installed in apps/mobile | ✅ AE525       |
| First Aether mobile surface mounted (Pulse)           | ✅ AE526-AE527 |
| EAS feature flag wired                                | ✅ AE528       |
| .env.example + aether mobile README                   | ✅ AE528       |
| **Surface ports 2-10**                                | ⏳ next        |

## Operator-owed

- Push the AE524 → AE529 chain (6 commits this round) + the still-
  unpushed AJ-AS history. **~83 unpushed commits total.**
- EAS bootstrap (`eas login` + `eas project:init`), Apple Developer
  account, Google Play Console account: all still pending.
- Admin-token fallback for mobile admin: still pending.
- Once EAS is bootstrapped + the dev / preview channel runs:
  validate the Pulse glow on a real device. The breathing math is
  mathematically identical to web (AE489 invariants pin both) but
  the visual smoothness depends on Skia 1.12.4's frame timing on
  the target hardware.

## Next round candidates

1. **Drift mobile** — first R3F-native surface port. Mount
   `<Canvas>` from `@react-three/fiber/native` + an `expo-three`
   `SunDisk` + `AmbientField`. Big slice; touches a lot of new RN
   plumbing.
2. **`@app/aether-core-native` consumed by apps/mobile** — wires
   the surface manager + palette context, so Pulse mood derives
   from the lifecycle phase instead of being a static prop.
3. **Atlas mobile** — heaviest surface, but the most demoable.
   Likely lands across 2-3 rounds.
4. **AE490+: more canvas-shared own behavioural specs** — there
   are still ~16 modules without dedicated specs.

## See also

- [`25-round-as-progress.md`](25-round-as-progress.md) — Round AS (Tamagui-out)
- [`24-round-ar-progress.md`](24-round-ar-progress.md) — Round AR (Phase 4 kickoff)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
