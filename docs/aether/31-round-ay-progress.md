# Round AY progress — Lumen + Echo (8/10 surfaces live)

> Round AY ports the next two R3F-native surfaces — Lumen (the photo
> cloud) and Echo (the social feed) — each with a sample fixture + a
> live route. Eight of ten surfaces now render on mobile. Only Genie
> (R3F) and Mirror (Skia) remain. apps/mobile typecheck stays clean.

## Slice inventory

| Slice | Title                                                  | Files                                                                     |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| AE548 | Sample Lumen photos + Echo feed fixtures               | `apps/mobile/src/aether/{sample-lumen.ts, sample-echo.ts}`                |
| AE549 | `<AetherLumenScene/>` R3F-native photo cloud           | `apps/mobile/src/aether/lumen-scene.tsx`                                  |
| AE550 | `/aether/lumen` route + Lumen/Echo explore links + nav | `apps/mobile/app/aether/lumen.tsx` + `_layout.tsx` + `(tabs)/explore.tsx` |
| AE551 | `<AetherEchoScene/>` R3F-native card stack             | `apps/mobile/src/aether/echo-scene.tsx`                                   |
| AE552 | `/aether/echo` route                                   | `apps/mobile/app/aether/echo.tsx`                                         |
| AE553 | Round AY closeout doc + PROGRESS catch-up              | `docs/aether/31-round-ay-progress.md` + README + PROGRESS                 |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (two new R3F scenes + two routes + two fixtures)
- `@app/aether-canvas-shared` jest: still 745 ✓ (both surfaces reuse
  already-spec'd math — lumen-cloud AE507 + echo-layout/echo-feed AE503)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE549 added — Lumen

`<AetherLumenScene/>` is the memory studio: a trip's photos suspended in
a 3D cloud, spread along time (X) + rating (Y). Cloud layout from
`layoutPhotoCloud` (canvas-shared AE457, spec'd AE507) — so a photo set
produces an identical cloud on web + mobile.

First cut paints solid palette-tinted planes (no textures): each plane's
tint keys to its X position via a local 3-channel `blendHex` (olive →
ochre), so the cloud reads as a time gradient. The `url` field is
threaded through each `LumenPlaneLayout` so the real `<PhotoPlane>`
texture swap (Expo Asset) is a local change later. Gentle whole-cloud
idle rotation, frozen under `reducedMotion`.

## What AE551 added — Echo

`<AetherEchoScene/>` is the social feed, rendered as a depth stack of
cards (not a flat FlatList) so it keeps the Aether spatial feel. Card
geometry from `echoCardY` + `echoCardScale` + `echoCardOpacity` +
`visibleEchoSlots` (canvas-shared AE477, spec'd AE503). Each card's tint
comes from `echoPaletteFromDominantColor(dominantColor)` — the AE420
palette re-derivation, so the surface tints identically to web (active
card lifts to the accent slot; neighbours sit at surface).

First cut renders the active card + its 2-deep neighbours as
palette-tinted planes. The swipe gesture (gesture-handler PanGesture →
`echoActionForSwipe` → `nextEchoIndex`) lands in a later interaction
slice; for now the stack auto-advances every 3.5s so the depth reads.
Frozen under `reducedMotion`.

## Fixtures (AE548)

- `sample-lumen.ts` — 12 `LumenPhotoLike` across 4 days, ratings spread
  (incl two null) so the X+Y axes are exercised.
- `sample-echo.ts` — 5 `EchoItem` (Pangong / Anjuna / Varanasi /
  Alleppey / Hampi) each with a distinct `dominantColor` so the palette
  re-derivation drives per-card tinting.

Both `url`/`photoUrl` null — the first-cut scenes paint solid planes.
Dropped when the routes wire to real data.

## Coverage state after AY

**Surfaces shipped on mobile:** 8 / 10.

| Surface   | Renderer | Status                        |
| --------- | -------- | ----------------------------- |
| Pulse     | Skia     | ✅ live overlay (AE526-527)   |
| Continuum | Skia     | ✅ live route (AE531 + AE541) |
| Drift     | R3F      | ✅ live route (AE534-537)     |
| Atlas     | R3F      | ✅ live route (AE539-540)     |
| Compass   | R3F      | ✅ live route (AE543-544)     |
| Vault     | R3F      | ✅ live route (AE545-546)     |
| Lumen     | R3F      | ✅ live route (AE549-550)     |
| Echo      | R3F      | ✅ live route (AE551-552)     |
| Genie     | R3F      | ⏳ next                       |
| Mirror    | Skia     | ⏳ last                       |

Six R3F surfaces + two Skia surfaces are live. **Two remain**: Genie
(R3F voice/camera modal — needs expo-av + expo-camera, the heaviest
remaining native plumbing) and Mirror (the last Skia surface — admin
forensics, minus the audit-river overlay on mobile).

## Operator-owed

- Push the AE548 → AE553 chain (6 commits this round) + the still-
  unpushed AJ-AX history. **~107 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate the six R3F surfaces on a device.** All typecheck; none
  have rendered — the GL runtime needs an EAS dev build.

## Next round candidates

1. **Genie mobile** (R3F) — the voice/camera modal. Needs expo-av
   (recording) + expo-camera (camera mode) installs + the genie-state
   FSM (spec'd AE492) + genie-particles dissolution (canvas-shared).
   The heaviest remaining surface.
2. **Mirror mobile** (Skia) — the last surface. Admin forensics list +
   the mirror-investigate helpers (spec'd in canvas-shared). Flat Skia
   per the renderer policy.
3. **Surface depth** — wire the real gestures/data: Echo swipe, Lumen
   textures, Atlas tap-to-focus, Vault checkout, real Compass heading.
   Trades breadth for interaction depth before the final two surfaces.

## See also

- [`30-round-ax-progress.md`](30-round-ax-progress.md) — Round AX (Compass + Vault)
- [`29-round-aw-progress.md`](29-round-aw-progress.md) — Round AW (Atlas + routing)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
