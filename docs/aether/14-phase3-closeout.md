# Phase 3 closeout — Echo + Mirror + Live trip-watch scaffolds

> Status as of 2026-06-01. Phase 3 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md)) ships **Echo** (social feed),
> **Mirror** (admin forensics rebuild), and the **Live trip-watch**
> overlay (Tier 4 T4-Ag.2) as honest scaffolds wired end-to-end through
> the Phase 1 + Phase 2 infrastructure. **Compass Eye AR** stays
> deferred to Phase 5 per decision #8.
>
> The AI / streaming back-ends that live behind these surfaces — feed
> controller adapter, WebTransport feed delivery, real `useAdminSosController*`
> wiring, the WebTransport presence stream for live trip-watch — land
> in dedicated b-slices once those services are plugged in.
>
> Read this AFTER [`13-phase3-progress.md`](13-phase3-progress.md) (the
> per-surface capability stack) and
> [`12-phase2-closeout.md`](12-phase2-closeout.md) (the Phase 2 closeout
>
> - the b-slice list pattern this doc inherits).

## What shipped (AE418 → AE428)

| Slice     | Surface   | Headline                                                                  |
| --------- | --------- | ------------------------------------------------------------------------- |
| AE418     | Echo      | Pure feed helpers + 5 sample fixtures + R3F scene scaffold + shell route  |
| AE419     | Echo      | R3F vertical-scroll textured-plane stack with per-frame Y + scale lerp    |
| AE420     | Echo      | Pointer / wheel / keyboard swipe handlers + live palette re-derivation    |
| AE421+422 | Mirror    | R3F translucent globe + SOS dots + scam clusters + audit-log river        |
| AE423     | docs      | First Phase 3 progress doc                                                |
| AE424     | Mirror    | Cmd+K "Investigate user" forensic palette (search + dashboard + severity) |
| AE425     | Atlas     | Live trip-watch overlay (T4-Ag.2 scaffold) on `/aether/journey/[id]`      |
| AE426     | docs      | Phase 3 progress doc update                                               |
| AE427     | Storybook | Chromatic baselines for 4 Phase 3 components (Echo / Mirror / LiveWatch)  |
| AE428     | tests     | jsdom integration specs for EchoFeed + AuditRiver + InvestigatePalette    |

## Routes live in dev

- `/aether/feed` — Echo (scroll, swipe, palette re-tint)
- `/aether/mirror` — Mirror (rotating globe + audit river + Cmd+K palette)
- `/aether/journey/<id>` — Atlas + Live trip-watch overlay
- All Phase 1 + 2 routes still 200

## Test totals (post AE428)

| Package              | Specs | Net change since Phase 2 closeout (AE417)           |
| -------------------- | ----- | --------------------------------------------------- |
| `@app/aether-core`   | 122   | 0                                                   |
| `@app/aether-canvas` | 77    | 0                                                   |
| `@app/aether-audio`  | 71    | 0                                                   |
| `apps/web`           | 2208  | +173 across +11 spec files (8 unit + 3 integration) |

`pnpm --filter web typecheck` clean. `pnpm --filter aether-storybook typecheck` clean. 0 new lint errors.

## What's deferred to b-slices

Each Phase 3 slice that depends on a back-end ships its UI + state machine + form contract today and waits for the live service to plug in:

- **AE418b–AE420b** — `useFeedController*` + `useSocialGraphController*` adapter so the Echo feed reads from real activity; WebTransport low-latency delivery; procedural per-echo audio bed (Tone.js mixing destination key + dominant photo colour); real `save place` + `follow traveller` mutation hooks.
- **AE421b–AE422b** — `useAdminSosController*` for live SOS dots; `useAdminScamModerationController*` for scam-cluster geocoding; a new admin/audit WebTransport stream so the river is real time; pulsing animation on SOS dots; textured land mass on the globe; Meilisearch admin-action index for the Cmd+K search.
- **AE424b** — Real admin SDK fan-out behind the Cmd+K palette (`useAdminUsersControllerSearch` + per-user trip / review / payment / audit lookups) so the forensic dashboard assembles from live data instead of the fixture map.
- **AE425b** — Real WebTransport presence stream behind `<LiveTripWatchOverlay>` (currently a synthesised fixture frame) so the Atlas overlay reflects the traveller's actual location + speed; multi-traveller presence on collaborative trips; "follow" → push notification path.

## Operator-owed for Phase 3 promotion

The git tree carries the AE418 → AE428 commit chain locally and not on the remote (the operator-only push policy stands). When promoting Phase 3:

1. Push the AE418 → AE428 commit chain to `origin/main` (classifier blocks; operator only).
2. Flip `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` on prod once the chain lands (no new env flag yet — Phase 3 still rides Phase 1's flag until the b-slices land).
3. When AE418b lands, wire the WebTransport endpoint env (e.g. `WT_FEED_URL`) so Echo can subscribe live.
4. When AE424b lands, promote admin/superadmin roles for live `/aether/mirror` viewers (existing RBAC; no new ENV).
5. When AE425b lands, wire `WT_PRESENCE_URL` env for the live trip-watch channel.

## Phase 1 + 2 inheritance

Echo, Mirror, and the live trip-watch overlay reuse every Phase 1 + Phase 2 building block intact:

- **Lifecycle FSM** + camera driver + breathing plan (Phase 1)
- **Per-surface palette** + `<SurfacePaletteVars/>` + `<SurfacePaletteOverride>` (AE381 + AE384) — Echo re-derives the palette per active echo via the override
- **Audio bridge** + Tone.js engine + key signature (Phase 1)
- **Pulse** corner glow + **hold-to-talk → Genie** (AE416) — every Phase 3 shell mounts the Pulse + Genie pair
- **Genie modal** full scaffold (AE406–AE413) including the SVG dissolve close
- **Continuum bar** + receiver toast (Phase 1)

None of the Phase 3 surfaces needed to rebuild the shell shape. They all mount the standard `<SurfaceManagerProvider>` + `<SurfaceCanvas>` + `<SurfaceAudioLayer>` triple + their own provider stack on top.

## Where the source of truth lives

- Live surface registry: `apps/web/src/components/aether/phase1/aether-registry.ts` (echo + mirror land alongside the Phase 1 + 2 surfaces, now 9 entries)
- Per-slice pure helpers + paired vitest specs: `apps/web/src/components/aether/phase3/*.ts(x)` + `apps/web/test/lib/*.spec.{ts,tsx}`
- 3 shells: `phase3-echo-shell.tsx`, `phase3-mirror-shell.tsx`; live trip-watch overlay mounts inside `phase1-atlas-shell.tsx`
- Storybook stories: `apps/aether-storybook/stories/aether/EchoCard.stories.tsx`, `LiveTripWatch.stories.tsx`, `MirrorAuditRiver.stories.tsx`, `MirrorInvestigatePalette.stories.tsx`
- Surface specs: [`02-surfaces.md`](02-surfaces.md) §6 Echo, §9 Mirror, plus 04-sequencing.md Phase 3 for the live trip-watch line item

## See also

- [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 closeout
- [`11-phase2-progress.md`](11-phase2-progress.md) — Phase 2 capability stack
- [`12-phase2-closeout.md`](12-phase2-closeout.md) — Phase 2 closeout + b-slice list
- [`13-phase3-progress.md`](13-phase3-progress.md) — Phase 3 capability stack (this doc's longer sibling)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 (mobile parity) plan
- [`02-surfaces.md`](02-surfaces.md) — §6 Echo, §9 Mirror specs
- [`04-sequencing.md`](04-sequencing.md) — six-phase plan
