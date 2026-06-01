# Round AR progress — Phase 4 kickoff (native foundation packages)

> Round AR is the **first real Phase 4 code**. Up to AQ, everything
> tagged "Phase 4 prep" was canvas-shared extractions + behavioural
> specs. Round AR locks the three blocking decisions, then scaffolds
> the three cross-cutting foundation packages the per-surface ports
> will sit on:
>
> 1. `@app/aether-core-native` — re-exports @app/aether-core +
>    adds the React-Context palette slots replacement for the
>    web's CSS custom properties.
> 2. `@app/aether-canvas-native` — re-exports canvas-shared pure
>    math + locks the per-surface renderer policy (R3F-native
>    for depth, Skia for flat).
> 3. `@app/aether-audio-native` — re-exports the pure audio math
>    - ships the NativeAudioEngine adapter contract that the
>      future expo-av implementation will satisfy.
>
> All three packages typecheck cleanly + ship paired shape-gate
> specs. None of them depend on react-native / expo / Tamagui /
> Skia yet — the deps land when apps/mobile starts consuming.

## Decisions locked (AE513)

| #   | Decision           | Locked answer                                                                                                                                   |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tamagui-out vs in  | **Tamagui-out** — parity with web's no-design-system stance; drop the dep + replace primitives.                                                 |
| 2   | Skia vs R3F native | **R3F-native for depth, Skia-flat for flat** — R3F via expo-three for Drift/Atlas/Lumen/Compass/Vault/Echo; Skia for Pulse glow + Mirror admin. |
| 3   | Build target       | **Single binary, env-flag gated** — one Expo binary for both stores, `EXPO_PUBLIC_FEATURE_AETHER_PHASE1` mirrors the web flag.                  |

## Slice inventory

| Slice | Title                                       | Files                                                     | Tests |
| ----- | ------------------------------------------- | --------------------------------------------------------- | ----- |
| AE513 | Lock the 3 Phase 4 decisions in phase4-plan | `docs/aether/15-phase4-plan.md`                           | n/a   |
| AE514 | @app/aether-core-native scaffold            | `packages/aether-core-native/` (7 files)                  | +6    |
| AE515 | @app/aether-canvas-native scaffold + policy | `packages/aether-canvas-native/` (7 files)                | +10   |
| AE516 | @app/aether-audio-native scaffold + adapter | `packages/aether-audio-native/` (7 files)                 | +15   |
| AE517 | Round AR closeout doc + PROGRESS.md         | `docs/aether/24-round-ar-progress.md` + README + PROGRESS | n/a   |

## Test bar

- `@app/aether-core-native` jest: 6/6 ✓
- `@app/aether-canvas-native` jest: 10/10 ✓
- `@app/aether-audio-native` jest: 15/15 ✓
- `@app/aether-canvas-shared` jest: still 690/690 ✓ (untouched)
- `web` typecheck: clean

## What each foundation package adds

### AE514 — @app/aether-core-native

Mirrors `@app/aether-core` for RN. The web package's surface manager,
lifecycle FSM, palette helpers, theme + reduced-motion + premium
contexts all run on React only — no DOM dependency at runtime (the
few useEffects that touch DOM guard `typeof document === 'undefined'`
and no-op). So this native package re-exports the entire web barrel
verbatim and adds:

1. **`SurfacePaletteSlotsContext`** — React Context replacing the
   web's `<SurfacePaletteVars>` CSS custom properties. RN has no
   global document root + no CSS var system; the same five slots
   (ink / surface / accent / glow / support) ride a Context instead.
2. **`<SurfacePaletteSlotsProvider>`** — mirrors
   `useSurfacePaletteSlots()` into the Context. Mount once high in
   the tree; descendants read via `useSurfacePaletteSlotsFromContext()`
   without subscribing to manager re-renders.

`<SurfacePaletteVars>` is re-exported transparently for migration
ergonomics — it's a harmless no-op on RN.

### AE515 — @app/aether-canvas-native

Two parallel renderer paths land here per Phase 4 decision #2:

- **R3F native** (via expo-three + `@react-three/fiber/native`) for
  Drift / Atlas / Lumen / Compass / Vault / Echo / Genie.
- **Skia** (via `@shopify/react-native-skia`) for Pulse / Mirror /
  Continuum.

The split ships as a single frozen `RENDERER_MAP` table +
`rendererForSurface()` lookup + `r3fNativeSurfaceIds()` /
`skiaSurfaceIds()` partition helpers. AE515 deliberately does NOT
ship per-surface scene files yet; the policy table is the audit
surface for the renderer choice.

The package re-exports the entire canvas-shared pure-math barrel so
native scenes import from one place + get identical semantics to
web R3F scenes. AE489 invariants apply unchanged to both.

### AE516 — @app/aether-audio-native

Tone.js (web) becomes expo-av (native) + precomputed AAC drone
loops keyed by destination. The pure math (destination keys / note
picker / scene mixer / scene-audio-bridge) ships verbatim from
`@app/aether-audio` since none of it touches Tone — it's pure dB
constants + gain envelopes + key maps.

AE516 ships:

1. Re-export of the pure-math surface from `@app/aether-audio`
   (DESTINATION_KEYS, bellWeights, channelGainsAt, etc.).
2. `NativeAudioEngine` contract: 4-status union
   (idle/starting/running/stopped) + `start(slug)` / `stop()` /
   `applyMix(gains)` methods.
3. `createNullNativeAudioEngine()` returning an engine whose methods
   throw with a missing-engine error — consumers fail loudly when no
   real engine is mounted (vs silently swallowing audio events).

The Tone.js-backed web hooks (`SurfaceAudioLayer`, `useSurfaceKey`,
`useSceneAudioBridge`) are NOT re-exported. Native equivalents land
once apps/mobile is wired up.

## Architectural notes

- All three native packages live in the monorepo workspace (not in
  the `!apps/mobile` ignore zone). They typecheck + jest under the
  root workspace and will be consumed by `apps/mobile` via the
  same `link:` pattern as `@app/sdk`.
- `lib: ["ES2022", "DOM", "DOM.Iterable"]` is in each package's
  tsconfig — necessary because the web parents reference `window`
  / `document` / `MediaQueryListEvent` for their DOM guards. The
  DOM lib is compile-time only; runtime guards handle the actual
  no-op on RN.
- No `react-native` / `expo` / `expo-three` / `@react-three/fiber`
  / `@shopify/react-native-skia` deps installed yet. Those land
  one at a time when the first consumer surface needs them.
- The new packages export `react` only as a peerDependency so they
  don't pin a specific React version.

## What this unblocks

The next 3 phases of Phase 4 work can now begin in any order:

1. **Strip Tamagui from apps/mobile** (decision #1 implementation).
   Touches a lot of files but the per-component replacements are
   straightforward (Tamagui's `Stack` → plain `View`, `H1` → `Text`
   with explicit styles, etc.). Most natural starting point.

2. **First surface port: Pulse (Skia)** — the smallest, lowest-risk
   surface. Mount the Skia 64-px corner glow + breathing helpers
   from canvas-shared. Builds confidence in the Skia path before
   tackling R3F native.

3. **First R3F-native scene: Drift** — the visual centrepiece.
   Heaviest scene file but proves the expo-three path end-to-end.
   Most useful demoable artifact.

## Operator-owed

Unchanged from AQ (and added to):

- Push the AE513 → AE517 chain (5 commits this round) + the still-
  unpushed AJ-AQ history. **~71 unpushed commits total.**
- EAS bootstrap: `eas init` + `eas.json` build profiles. Required
  before the first TestFlight / Play Internal cut.
- Apple Developer account + Google Play Console account: neither
  exists yet.
- Admin-token fallback for mobile admin (the web `ADMIN_IP_ALLOWLIST`
  - `promote-user.sh` are web-only).
- Mobile environment variables: `WT_FEED_URL`, `WT_PRESENCE_URL`.

## See also

- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan + locked decisions
- [`23-round-aq-progress.md`](23-round-aq-progress.md) — Round AQ (canvas-shared specs round 3)
- [`04-sequencing.md`](04-sequencing.md) — six-phase plan
