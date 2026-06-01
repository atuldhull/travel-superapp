# Round AS progress — Tamagui-out from apps/mobile

> Round AS is the second slice of Phase 4 implementation, executing
> the locked decision #1 from Round AR: **Tamagui-out**. Every
> Tamagui import + every Tamagui primitive in `apps/mobile` is gone.
> The 1.0 mobile routes (12 of them) now use plain React Native +
> Expo primitives, and the three Tamagui npm packages
> (`tamagui`, `@tamagui/config`, `@tamagui/lucide-icons`) are out of
> `apps/mobile/package.json`. 124 transitive packages removed from
> the mobile lockfile.
>
> apps/mobile typecheck passes cleanly. None of the runtime
> behaviour changed — only the visual layer became plain-RN
> defaults, which is the expected outcome for the 1.0 mobile
> scaffolding that Phase 4 will retire and replace with native
> Aether surfaces.

## Workflow

A single Workflow invocation (`round-as-strip-tamagui`) ran 24
agents in a parallel read → rewrite pipeline. The schema for the
rewrite stage was tight:

- Drop every Tamagui import; substitute with plain RN primitives
  (`<View>`, `<Text>`, `<TouchableOpacity>`, `<TextInput>`,
  `<ActivityIndicator>`, `<StyleSheet.create>`).
- `@tamagui/lucide-icons` becomes short text labels (no new icon
  library pulled in — keep the patch surface small).
- `<TamaguiProvider>` + `<Theme>` wrapping in `app/_layout.tsx`
  drops entirely.
- Preserve EVERY routing / data fetching / form / nav behaviour
  verbatim.

12 file rewrites returned, all 12 written verbatim, **apps/mobile
typecheck green on the first run.** No fix-ups needed.

## Slice inventory

| Slice | Title                                                      | Files                                                                                    |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AE518 | apps/mobile root layout: drop TamaguiProvider + Theme      | `apps/mobile/app/_layout.tsx`                                                            |
| AE519 | apps/mobile (tabs)/\* (5 files): YStack/XStack/H4/etc.     | `apps/mobile/app/(tabs)/{_layout,trips,explore,inbox,profile}.tsx`                       |
| AE520 | apps/mobile auth routes (4 files): YStack/Input/Button     | `apps/mobile/app/{login,register,auth/magic-link,auth/magic-link/[token]}.tsx`           |
| AE521 | apps/mobile detail routes (2 files): heaviest 1.0 surfaces | `apps/mobile/app/trips/[id].tsx` + `apps/mobile/app/memory-books/[id].tsx`               |
| AE522 | Drop Tamagui deps + delete tamagui.config.ts               | `apps/mobile/{package.json, pnpm-lock.yaml}` + `apps/mobile/tamagui.config.ts` (deleted) |
| AE523 | Round AS closeout + PROGRESS catch-up                      | `docs/aether/25-round-as-progress.md` + README + PROGRESS                                |

## Test bar

- `apps/mobile` typecheck (`pnpm typecheck` from `apps/mobile/`): **clean** ✓
- `apps/mobile` lockfile: **-124 packages** (Tamagui + sub-deps gone)
- `@app/aether-{core,canvas,audio}-native` jest: still 6 + 10 + 15 = 31 ✓
- `@app/aether-canvas-shared` jest: still 690 ✓
- web typecheck: untouched + still clean

## Tamagui → React Native substitution table

| Tamagui primitive                 | RN replacement                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `<YStack gap={N}>`                | `<View style={{ flexDirection: 'column', gap: N }}>`                           |
| `<XStack gap={N}>`                | `<View style={{ flexDirection: 'row', gap: N }}>`                              |
| `<Stack>`                         | `<View>`                                                                       |
| `<Text>` / `<Paragraph>`          | RN `<Text>` with explicit `fontSize` + `color`                                 |
| `<H1>` / `<H2>` / `<H3>` / `<H4>` | RN `<Text>` with `fontSize` 28 / 24 / 20 / 18 + `fontWeight: '600'`            |
| `<Button>`                        | `<TouchableOpacity>` wrapping `<Text>`                                         |
| `<Input>`                         | `<TextInput>` (preserve placeholder, value, onChangeText)                      |
| `<Spinner>`                       | `<ActivityIndicator>`                                                          |
| `<Card>`                          | `<View>` with padding + borderRadius + shadowColor/Offset/Opacity inline style |
| `<TamaguiProvider>` + `<Theme>`   | Drop the wrapping. Children render directly.                                   |
| `@tamagui/lucide-icons`           | Single-letter text labels (T/E/I/P for the 4 tabs; "Share" for share intent)   |

The icon substitution is the only visual concession that's user-
visible — tab icons are now letters rather than vector icons. A TODO
marker in `(tabs)/_layout.tsx` flags this for replacement once the
Aether mobile Pulse surface ships. Every other replacement preserves
the original layout intent exactly.

## What this unblocks

With Tamagui out, the next Phase 4 work can start in any order:

1. **First surface port: Pulse (Skia)** — smallest, lowest-risk
   surface. Mount Skia 64-px corner glow + breathing helpers from
   canvas-shared. Builds confidence in the Skia path before tackling
   R3F native.
2. **First R3F-native scene: Drift** — the visual centrepiece.
   Heaviest scene file but proves the expo-three path end-to-end.
3. **`@app/aether-core-native` / `@app/aether-canvas-native` /
   `@app/aether-audio-native` consumed by apps/mobile** — the
   `link:` wiring follows the existing `@app/sdk` pattern.

## Operator-owed (unchanged)

- Push the AE518 → AE523 chain (6 commits this round) + the still-
  unpushed AJ-AR history. **~77 unpushed commits total.**
- EAS bootstrap, Apple Developer account, Google Play Console
  account: all still pending.
- Admin-token fallback for mobile admin: still pending.
- Mobile envs `WT_FEED_URL`, `WT_PRESENCE_URL`: still pending.

## See also

- [`24-round-ar-progress.md`](24-round-ar-progress.md) — Round AR closeout (Phase 4 kickoff)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 plan + locked decisions
- [`04-sequencing.md`](04-sequencing.md) — six-phase plan
