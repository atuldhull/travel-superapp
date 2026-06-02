# Round BB progress — Compass real heading + Atlas tap-to-focus

> Round BB continues Phase 4 depth: the Compass needle now tracks the
> real device heading (expo-location), and Atlas orbs respond to taps
> with a focus + place card. Two more surfaces get real hands; no new
> surfaces.

## Slice inventory

| Slice | Title                                       | Files                                                     |
| ----- | ------------------------------------------- | --------------------------------------------------------- |
| AE563 | `useDeviceHeading` hook (expo-location)     | `apps/mobile/lib/use-device-heading.ts`                   |
| AE564 | Wire real heading into the Compass route    | `apps/mobile/app/aether/compass.tsx`                      |
| AE565 | Atlas tap-to-focus orb + place card overlay | `apps/mobile/src/aether/atlas-scene.tsx`                  |
| AE566 | Round BB closeout doc + PROGRESS catch-up   | `docs/aether/34-round-bb-progress.md` + README + PROGRESS |

## Test bar

- `apps/mobile` typecheck: **clean** ✓
- `@app/aether-canvas-shared` jest: still 745 ✓ (no canvas-shared changes this round)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE563 + AE564 added — Compass real heading

`useDeviceHeading()` subscribes to expo-location's `watchHeadingAsync`
and returns the heading in degrees (0 = north), or `null` when
unavailable (permission denied / no magnetometer / web). It prefers
`trueHeading` (geographic north w/ declination correction) when the
platform provides it (>= 0), falling back to `magHeading`. Permission-
then-subscribe mirrors the existing `use-geolocation` (S-D2) pattern;
the `LocationSubscription` is removed on unmount.

The Compass route feeds it into `<AetherCompassScene
headingDegrees={heading ?? undefined} />`, so the needle tracks the
real device compass. When the heading is null the prop falls back to
undefined and the scene's self-sweep demo takes over — the surface is
always alive. **This is the first Aether mobile surface driven by a real
device sensor.**

## What AE565 added — Atlas tap-to-focus

Each orb gets an R3F `onClick` (stopPropagation) that lifts the tapped
`OrbLayout` into scene state — the same pattern as the AE561 Vault tap.
The focused orb grows 1.5x + shifts to terracotta with a brighter
emissive; the whole-field idle rotation pauses while focus is held so
the card stays readable.

A `<PlaceCard/>` overlay slides in at the bottom showing the orb's day +
stop number + place name (derived from the synthetic `place-<slug>` id
for now). Close clears focus + resumes the rotation. A future slice
reads the real place row via the SDK.

## Phase 4 depth — running tally

| Surface | Interaction depth                 | Status          |
| ------- | --------------------------------- | --------------- |
| Echo    | swipe → walk feed / save / follow | ✅ AE559        |
| Vault   | tap glyph → checkout panel → book | ✅ AE560-561    |
| Genie   | tap mic → FSM walk                | ✅ AE554 (demo) |
| Compass | needle tracks real device heading | ✅ AE563-564    |
| Atlas   | tap orb → focus + place card      | ✅ AE565        |
| Lumen   | photo textures (Expo Asset)       | ⏳              |
| Mirror  | real admin audit stream           | ⏳ backend      |

Five of the seven non-trivial surfaces now have real interaction. Lumen
(textures) + Mirror (real admin data) remain, plus the backend b-slices
(Genie STT/camera, WebTransport feeds, real Stripe, admin stream).

## Operator-owed

- Push the AE563 → AE566 chain (4 commits this round) + the still-
  unpushed AJ-BA history. **~122 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate on a device.** Compass needs a real magnetometer (the
  heading hook is untestable on web/simulator without one); the Atlas
  orb picking needs the R3F event raycaster on native. Both are device-
  only confirmations.

## Next round candidates

1. **Lumen photo textures** — Expo Asset + `useTexture` so the cloud
   planes show real photos. The last big "make it real" visual slice.
2. **`@app/aether-core-native` consumed** — derive surface
   mood/lifecycle + palette from the manager rather than static props.
   The structural slice that unblocks the audio layer + lifecycle-driven
   animation; carries the React-18/19 `@types` risk mitigated for
   canvas-shared (the aether-core-native barrel re-exports the
   React-19-typed aether-core — may need the same inlining treatment).
3. **EAS bootstrap** (operator) — the gate that turns every "typechecks"
   into "runs". Highest-value remaining task.

## See also

- [`33-round-ba-progress.md`](33-round-ba-progress.md) — Round BA (Echo swipe + Vault checkout)
- [`32-round-az-progress.md`](32-round-az-progress.md) — Round AZ (Genie + Mirror; 10/10 breadth)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
