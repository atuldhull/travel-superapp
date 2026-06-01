# Phase 3 progress — Echo + Mirror scaffolds

> Status as of 2026-06-01. Phase 3 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md)) adds **Echo** (social feed)
> and **Mirror** (admin forensics rebuild). Compass Eye (mobile AR) is
> deferred to Phase 5 per decision #8. Live trip-watch (Tier 4 T4-Ag.2)
> lands once the WebTransport stream is wired.
>
> Both surfaces ride `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` until Phase 3
> earns its own flag. Read this AFTER
> [`12-phase2-closeout.md`](12-phase2-closeout.md) (the Phase 2 closeout
>
> - the b-slice list it shares the pattern with).

## What's live

| Surface | Route            | Scene state                                                                                      | Slice IDs   |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| Echo    | `/aether/feed`   | R3F vertical-scroll photo stack + swipe / wheel / keyboard gestures + live palette re-derivation | AE418-AE420 |
| Mirror  | `/aether/mirror` | R3F translucent globe + SOS dots + scam-cluster discs + slow rotation + audit-log river overlay  | AE421-AE422 |

## Echo — capability stack

1. **Pure feed helpers + sample fixtures** (AE418) — `EchoItem` shape, `echoSwipeDirectionFromDelta` (vertical-dominant tie-break), `echoActionForSwipe` (up=save / right=follow / down=next / left=prev), `nextEchoIndex` clamping helper, `boostHexColor` saturation, `echoPaletteFromDominantColor` (5-slot Aether palette derived from a single hex), `formatEchoPostedAt`; `SAMPLE_ECHO_FEED` (5 curated echoes spanning Leh / Goa / Jaipur / Alleppey / Varanasi). `<EchoFeedProvider>` + `useEchoFeed()` carry items + active index.
2. **R3F vertical-scroll scene** (AE419) — `<EchoCard>` wraps `<PhotoPlane>` in an outer group that lerps Y + scale toward target each frame (speed 4.5 ≈ 220ms-to-closure); `echoCardY` / `echoCardScale` / `echoCardOpacity` / `visibleEchoSlots` ship as pure helpers so the texture budget stays bounded (±2 cards from active).
3. **Swipe + palette re-derivation** (AE420) — `useEchoSwipe({items, activeIndex, setActiveIndex, onAction?})` handles pointer (down/up delta → direction), wheel (throttled at `ECHO_WHEEL_THROTTLE_MS = 220` ms), keyboard (ArrowDown / j = next, ArrowUp / k = prev, s/f/p = save/follow/plan). `<PaletteFromActiveEcho>` wraps the inner shell in `<SurfacePaletteOverride>` whose palette is `echoPaletteFromDominantColor(active.dominantColor)`; AE381 `<SurfacePaletteVars/>` writes the CSS vars on every change so HTML consumers re-tint live. Action button row + 2.2 s toast feedback; 'Plan a trip like this' fires `openPulse()` with a seeded prompt.

**Not yet wired** — `useFeedController*` / `useSocialGraphController*` SDK adapter (sample fixtures ship today); the per-echo 5-sec procedural audio bed (Tone.js mixing destination key + dominant colour to a unique composition); WebTransport low-latency feed delivery; real "save place" + "follow traveller" mutation hooks.

## Mirror — capability stack (AE421 + AE422)

1. **Pure globe + audit helpers** (AE421) — `latLngToVec3(lat, lng, radius?)` (north pole = +Y; NaN-safe), `sosDotRadius(severity)` (severity 1-5 → 0.04..0.16 clamped), `scamClusterRadius(reportCount)` (sqrt scaling capped at 0.5), `liveAuditRows(rows, now?, ttl?)` + `auditRowYProgress(row, now?, ttl?)` (river positioning), `auditGlyphColor` / `auditGlyphSymbol` per kind, `isMirrorViewer(role)` admin gate. Constants: `MIRROR_GLOBE_RADIUS = 2.4`, `MIRROR_AUDIT_RIVER_TTL_MS = 60_000`.
2. **Sample data** (AE421) — 4 live SOS events (Mumbai, Delhi, Goa, Leh) + 4 scam clusters (Jaipur, Varanasi, Bangalore, Kolkata) + 6 audit rows seeded with elapsed times so the river reads as live on first paint.
3. **R3F globe scene** (AE421/AE422) — translucent palette-accent sphere + wireframe lat/lng grid + slow Y rotation at 0.06 rad/s; SOS dots as bright-red emissive spheres at the projected positions; scam clusters as palette-glow spheres sized by report count.
4. **Audit-log river** (AE422) — `<MirrorAuditRiver>` right-edge column; per-row glyph + summary; opacity fades as `auditRowYProgress` approaches 1; 1 s rAF tick re-checks `liveAuditRows(rows, Date.now())` so the river visibly falls on a static fixture set; AE422b swaps the tick for a real WebTransport stream when the backend ships.

**Not yet wired** — `useAdminSosController*` + `useAdminScamModerationController*` + a new admin/audit stream API; Cmd+K "Investigate user" forensic assembly (assembles trips + reviews + payments + audit-mentions into a single forensic dashboard); textured land mass (current globe is translucent + wireframe — first-cut visual); pulse animation on the SOS dots; Meilisearch admin-action index.

## Test totals (post AE422)

| Package              | Specs | Net change since Phase 2 closeout (AE417) |
| -------------------- | ----- | ----------------------------------------- |
| `@app/aether-core`   | 122   | 0                                         |
| `@app/aether-canvas` | 77    | 0                                         |
| `@app/aether-audio`  | 71    | 0                                         |
| `apps/web`           | 2141  | +106 across +6 spec files (Echo + Mirror) |

`pnpm --filter web typecheck` clean. 0 new lint errors.

## Live routes (dev)

- `/aether/feed` — Echo (scroll, swipe, palette re-tint)
- `/aether/mirror` — Mirror (rotating globe + audit river)
- All Phase 1+2 routes still 200

## Pending — Phase 3 finish line

1. **AE418b-AE420b** — Feed-controller adapter + WebTransport low-latency feed + procedural per-echo audio bed
2. **AE421b/AE422b** — Real admin SDK wiring (`useAdminSosController*` + scam moderation + audit stream); pulsing animation on SOS dots; Cmd+K "Investigate user" forensic dashboard
3. **AE424+ Live trip-watch** — Tier 4 T4-Ag.2 with WebTransport state-sync
4. **Compass Eye AR** — deferred to Phase 5 per decision #8

## Operator-owed for Phase 3 promotion

- Push the AE418 → AE423 commit chain to `origin/main` (operator-only push)
- Wire WebTransport endpoint env for live-feed + audit-stream when those land
- Promote admin/superadmin roles for the live `/aether/mirror` viewers (existing RBAC; no new ENV)

## Phase 1 + 2 inheritance

Echo + Mirror reuse every Phase 1 + Phase 2 building block intact:

- Surface manager + lifecycle FSM (Phase 1)
- Per-surface palette + `<SurfacePaletteVars/>` + `<SurfacePaletteOverride>` (AE381 + AE384)
- Audio bridge + Tone.js engine + key signature (Phase 1)
- Pulse corner glow + hold-to-talk → Genie (AE416)
- Genie modal (full scaffold, AE406-AE413)
- Continuum bar + receiver toast (Phase 1)

Neither surface needed to rebuild the shell shape. They both mount the standard `<SurfaceManagerProvider>` + `<SurfaceCanvas>` + `<SurfaceAudioLayer>` triple + their own surface-specific provider stack on top.

## See also

- [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 closeout
- [`11-phase2-progress.md`](11-phase2-progress.md) — Phase 2 capability stack
- [`12-phase2-closeout.md`](12-phase2-closeout.md) — Phase 2 closeout + b-slice list
- [`02-surfaces.md`](02-surfaces.md) — §6 Echo, §9 Mirror specs
- [`04-sequencing.md`](04-sequencing.md) — six-phase plan
