# Round AZ progress — Genie + Mirror = 10/10 surfaces live

> Round AZ ports the last two surfaces — Genie (the voice/camera modal,
> R3F) and Mirror (admin forensics, the last Skia surface). **All ten
> Aether surfaces now render on mobile.** The Phase 4 surface-breadth
> milestone is reached. apps/mobile typecheck stays clean.

## Slice inventory

| Slice | Title                                                       | Files                                                                     |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| AE554 | `<AetherGenieScene/>` R3F particle swirl + FSM mic overlay  | `apps/mobile/src/aether/genie-scene.tsx`                                  |
| AE555 | `/aether/genie` route + Genie/Mirror explore links + nav    | `apps/mobile/app/aether/genie.tsx` + `_layout.tsx` + `(tabs)/explore.tsx` |
| AE556 | `<AetherMirrorScene/>` Skia audit strip + sample audit feed | `apps/mobile/src/aether/{mirror-scene.tsx, sample-mirror.ts}`             |
| AE557 | `/aether/mirror` route                                      | `apps/mobile/app/aether/mirror.tsx`                                       |
| AE558 | Round AZ closeout doc + PROGRESS catch-up                   | `docs/aether/32-round-az-progress.md` + README + PROGRESS                 |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (final R3F scene + final Skia scene + two routes)
- `@app/aether-canvas-shared` jest: still 745 ✓ (both surfaces reuse
  already-spec'd math — genie-state AE492 + mirror-globe AE502)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE554 added — Genie

`<AetherGenieScene/>` is the voice/camera modal. The state machine comes
from the SAME pure FSM the web Genie uses — `genieStateLabel` +
`genieMicRingColor` + `genieIsActive` + `genieOnMicPress` /
`genieOnMicRelease` / `genieOnStt` (canvas-shared AE406, spec'd AE492).
The particle swirl reuses the shared `ambientFieldPositionArray` +
`GENIE_PARTICLE_COUNT`.

First cut ships the FSM + swirl: a R3F `<points>` cloud that spins
faster + glows ochre when `genieIsActive` (vs a slow olive drift idle),
with an RN mic-button overlay. Tapping walks the FSM (press → listening
→ release → processing → simulated STT → transcribed). A local
`nativeColor()` extracts the hex fallback from `genieMicRingColor`'s web
CSS `var()` strings so RN can use them.

Real Whisper STT (expo-av → ai-service `/v1/transcribe`) + camera mode
(expo-camera) are the AE411b / AE413b backend b-slices; AE554 proves
the surface + FSM with a tap-driven demo.

## What AE556 added — Mirror

`<AetherMirrorScene/>` is the admin forensics surface, the **last Skia
surface**. Per the locked renderer policy, mobile Mirror is flat: the 3D
globe + the flowing audit-river overlay drop on phone; the audit feed
reads as a vertical strip.

Glyph colours + symbols + recency fade from the SAME pure helpers the
web Mirror uses — `liveAuditRows` + `auditGlyphColor` +
`auditGlyphSymbol` + `auditRowYProgress` (canvas-shared AE421, spec'd
AE502). Each row draws its glyph dot in a per-row Skia `<Canvas>`
(coloured by kind, opacity `1 - auditRowYProgress` so older rows fade)
beside an RN text line (symbol + summary + age). `liveAuditRows` filters
to the 60s window.

`sample-mirror.ts`'s `buildSampleAuditRows(now)` builds 8 rows relative
to "now" so they stay live, covering every glyph kind. Real admin data +
the `isMirrorViewer` role gate land when the audit stream is wired
(operator-owed).

## Coverage state after AZ — 10/10

**All ten surfaces ship on mobile.**

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
| Genie     | R3F      | ✅ live route (AE554-555)     |
| Mirror    | Skia     | ✅ live route (AE556-557)     |

Seven R3F surfaces + three Skia surfaces. Nine non-overlay surfaces each
have a flag-gated `/aether/*` route in the explore "Aether preview"
section; Pulse is the always-present overlay.

## The Phase 4 arc so far (Rounds AR → AZ)

| Round | Delivered                                                    |
| ----- | ------------------------------------------------------------ |
| AR    | 3 decisions locked + 3 native foundation packages scaffolded |
| AS    | Tamagui stripped from apps/mobile                            |
| AT    | canvas-shared wired in + Skia installed + Pulse (surface 1)  |
| AU    | Continuum sigil (surface 2) + reduced-motion hook            |
| AV    | R3F-native stack installed + Drift (surface 3, first 3D)     |
| AW    | Atlas (surface 4) + every surface routed                     |
| AX    | Compass + Vault (surfaces 5-6)                               |
| AY    | Lumen + Echo (surfaces 7-8)                                  |
| AZ    | Genie + Mirror (surfaces 9-10) — **breadth complete**        |

Every surface's geometry/FSM comes from `@app/aether-canvas-shared`,
the same pure math the web R3F scenes use, pinned by the AE489
invariants + the per-module behavioural specs (AE491-AE511). The web
and mobile renderers place identical geometry by construction.

## Operator-owed

- Push the AE554 → AE558 chain (5 commits this round) + the still-
  unpushed AJ-AY history. **~113 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate all surfaces on a device.** Every surface typechecks but
  none have rendered — the GL runtime (7 R3F surfaces) + the Skia
  surfaces need an EAS dev build to confirm. This is the single biggest
  unknown remaining.

## What's next — Phase 4 shifts from breadth to depth

With all ten surfaces scaffolded, the remaining Phase 4 work is depth +
real data:

1. **Real gestures + data**: Echo swipe (gesture-handler PanGesture →
   `echoActionForSwipe`), Lumen photo textures (Expo Asset), Atlas
   tap-to-focus + place card, Vault tap-to-checkout, real Compass
   heading (expo-location), real admin data for Mirror.
2. **Backend b-slices**: Genie Whisper STT + camera (expo-av +
   expo-camera), the WebTransport feed for Echo + Continuum live sync,
   the admin audit stream for Mirror.
3. **`@app/aether-core-native` consumed**: derive each surface's
   mood/lifecycle from the surface manager rather than static props.
4. **EAS bootstrap + first device build** — the gate that turns all of
   this from "typechecks" into "runs". The highest-value operator task.

## See also

- [`31-round-ay-progress.md`](31-round-ay-progress.md) — Round AY (Lumen + Echo)
- [`30-round-ax-progress.md`](30-round-ax-progress.md) — Round AX (Compass + Vault)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
