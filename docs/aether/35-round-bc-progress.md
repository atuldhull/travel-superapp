# Round BC progress — palette consolidation + Lumen tap-to-inspect

> Round BC pairs a structural cleanup (the Warm Italian palette lives in
> one module now, not redefined per scene) with one more depth slice
> (Lumen tap-to-inspect). Six of seven non-trivial surfaces now have
> real interaction.

## Slice inventory

| Slice | Title                                           | Files                                                     |
| ----- | ----------------------------------------------- | --------------------------------------------------------- |
| AE567 | Shared mobile palette module + migrate 9 scenes | `apps/mobile/src/aether/palette.ts` + 9 scene files       |
| AE568 | Lumen tap-to-inspect — photo detail card        | `apps/mobile/src/aether/lumen-scene.tsx`                  |
| AE569 | Round BC closeout doc + PROGRESS catch-up       | `docs/aether/35-round-bc-progress.md` + README + PROGRESS |

## Test bar

- `apps/mobile` typecheck: **clean** ✓
- `@app/aether-canvas-shared` jest: still 745 ✓ (no canvas-shared changes)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE567 added — the palette module

Every Aether mobile scene redefined the same five hexes (ink / surface /
accent / glow / support) at the top of its file.
`apps/mobile/src/aether/palette.ts` is the single source of truth now:
`AETHER_INK / SURFACE / ACCENT / GLOW / SUPPORT` + two chrome neutrals
(`CREAM`, `MUTED`), all from the Warm Italian lock
(docs/aether/06-decisions.md #3).

Nine scene files (atlas / compass / drift / echo / genie / lumen / vault
/ pulse-glow / continuum-sigil) migrated to source their colour
constants from the module. Each keeps its semantic local alias
(`BACKGROUND`, `ORB_COLOR`, `GLOW_FILL`, ...) so only the const
definitions change — behaviour-neutral.

**Why now:** when `@app/aether-core-native`'s
`SurfacePaletteSlotsContext` is wired in, the palette module internals
swap to a context read in ONE place instead of nine. The module is the
seam. Consolidating before context lands means the context migration is
a one-file change, not a nine-file one.

## What AE568 added — Lumen tap-to-inspect

Each photo plane gets an R3F `onClick` (stopPropagation) that maps
`plane.id → LumenPhotoLike` and lifts it into scene state — the same tap
pattern as Vault (AE561) + Atlas (AE565). The focused plane grows 1.4x +
shifts to terracotta with a brighter emissive; the whole-cloud drift
pauses while focus is held.

A `<PhotoCard/>` overlay shows the photo's rating (`clampRating` → star
glyphs, or "Unrated") + capture time. A future slice swaps in the real
thumbnail once textures land (Expo Asset).

## Phase 4 depth — running tally

| Surface | Interaction depth                 | Status          |
| ------- | --------------------------------- | --------------- |
| Echo    | swipe → walk feed / save / follow | ✅ AE559        |
| Vault   | tap glyph → checkout panel → book | ✅ AE560-561    |
| Genie   | tap mic → FSM walk                | ✅ AE554 (demo) |
| Compass | needle tracks real device heading | ✅ AE563-564    |
| Atlas   | tap orb → focus + place card      | ✅ AE565        |
| Lumen   | tap plane → focus + photo card    | ✅ AE568        |
| Mirror  | (flat list, no tap yet)           | ⏳              |

**Six of seven** non-trivial surfaces now have real interaction. Only
Mirror (a flat audit list — natural tap target would expand a row) +
the backend b-slices remain.

The tap-to-X pattern is now used by three surfaces (Vault, Atlas,
Lumen): R3F mesh `onClick` (stopPropagation) → lift selection to scene
state → RN overlay card → close clears + resumes idle motion. A future
round could lift this into a shared `useR3FSelection` hook.

## Operator-owed

- Push the AE567 → AE569 chain (3 commits this round) + the still-
  unpushed AJ-BB history. **~125 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate on a device.** Every tap surface needs the R3F event
  raycaster on native; Compass needs a real magnetometer. None
  confirmed without an EAS dev build.

## Next round candidates

1. **Lumen photo textures** — Expo Asset + a texture loader so the cloud
   planes (and the focus card) show real photos. Needs real photo URLs
   (the media SDK) to be non-hollow.
2. **`@app/aether-core-native` consumed** — now that the palette module
   is the seam, swap its internals for `SurfacePaletteSlotsContext`.
   The structural slice; carries the React-18/19 `@types` risk (inline
   what's needed, like canvas-shared's `SurfaceLifecyclePhase`).
3. **`useR3FSelection` hook** — DRY the Vault/Atlas/Lumen tap pattern
   into one reusable hook.
4. **EAS bootstrap** (operator) — turns "typechecks" into "runs".

## See also

- [`34-round-bb-progress.md`](34-round-bb-progress.md) — Round BB (Compass heading + Atlas tap)
- [`33-round-ba-progress.md`](33-round-ba-progress.md) — Round BA (Echo swipe + Vault checkout)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
