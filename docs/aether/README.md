# Aether — TravelSuperApp 2.0 frontend

> **Status: Phase 1 + 2 + 3 scaffolds shipped + Round AJ polish + Round AK + Round AL canvas-shared completion (2026-06-01).** All ten surfaces from `02-surfaces.md` are scaffolded behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` except **Compass Eye AR** (deferred to Phase 5 per decision #8). Phase 3 closeout at [`14-phase3-closeout.md`](14-phase3-closeout.md); the Phase 4 mobile-parity plan is at [`15-phase4-plan.md`](15-phase4-plan.md); Round AJ (AE431-AE451) at [`16-round-aj-progress.md`](16-round-aj-progress.md). Backend b-slices (Whisper STT, CLIP, ML-Kit, Stripe, WebTransport feed, live admin SDK, presence stream) remain owed. Brand language locked to **Warm Italian tactile**.
>
> Codename for the complete frontend rebuild. Discards every current `apps/web/src/` and `apps/mobile/app/` pixel; keeps the API + `@app/sdk` + workers + ai-service untouched.
>
> Goal: a surface no competitor can copy inside 18 months — not because the algorithms are secret, but because the integration of motion + AI + spatial computing + audio + haptics + procedural visuals is so deep that copying any one piece misses the gestalt.

## Read in order

1. [`00-vision.md`](00-vision.md) — thesis, six principles, what "10 years ahead" means concretely.
2. [`01-architecture.md`](01-architecture.md) — package map, rendering layer, motion choreography, audio layer, perception, predictive prefetch, continuum.
3. [`02-surfaces.md`](02-surfaces.md) — the ten experience pillars (Drift / Atlas / Lumen / Genie / Compass / Echo / Pulse / Vault / Mirror / Continuum).
4. [`03-tech-stack.md`](03-tech-stack.md) — concrete library choices with versions + rationale.
5. [`04-sequencing.md`](04-sequencing.md) — six-phase plan, 14-30 month range depending on team posture.
6. [`05-uncopyability.md`](05-uncopyability.md) — why this is a real moat, not vapor.
7. [`06-decisions.md`](06-decisions.md) — the eight Phase-0 decisions, **locked**.
8. [`07-implementation-log.md`](07-implementation-log.md) — chronological one-line record of every AE commit.
9. [`08-data-flow.md`](08-data-flow.md) — ASCII diagrams of the seven main data flows.
10. [`09-component-catalog.md`](09-component-catalog.md) — every component + which route mounts it.
11. [`AETHER_E2E_KIT.md`](AETHER_E2E_KIT.md) — operator playbook (boot locally, walk surfaces, promote-admin, gate tests, launch flag).
12. [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 surface inventory, capability stack, deferred work, full commit chain AE374 → AE397.
13. [`11-phase2-progress.md`](11-phase2-progress.md) — Phase 2 scaffolds + stack — Lumen interactions, Genie modal + camera + dissolution + recorder, Vault R3F ring + checkout panel.
14. [`12-phase2-closeout.md`](12-phase2-closeout.md) — Phase 2 closeout inventory (AE398 → AE416), live routes, b-slice list (Whisper / CLIP / ML-Kit / Stripe), operator-owed for promotion.
15. [`13-phase3-progress.md`](13-phase3-progress.md) — Phase 3 scaffolds — Echo social feed (AE418-AE420) + Mirror admin forensics (AE421-AE422); per-surface capability stack + b-slice list.
16. [`14-phase3-closeout.md`](14-phase3-closeout.md) — Phase 3 closeout inventory (AE418 → AE428), live routes, b-slice list, operator-owed for promotion.
17. [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan: per-surface port order, decision locks (Tamagui-out / R3F-native vs Skia / single-binary), operator-owed for EAS + stores bootstrap.
18. [`16-round-aj-progress.md`](16-round-aj-progress.md) — Round AJ inventory (AE431-AE451): Phase 4 prep + Phase 2/3 polish — 9 Storybook variant sets, 4 jsdom integration spec files, 6 helper extractions / edge-case spec sweeps, 2 loading.tsx skeletons.
19. [`17-round-ak-progress.md`](17-round-ak-progress.md) — Round AK inventory (AE453-AE466): `@app/aether-canvas-shared` workspace package + Phase 1 polish — 10 pure modules moved to shared, Phase 1 shell integration specs, Lumen integration specs, 4 Storybook stories, 2 loading skeletons, 36 Phase 3 edge specs.
20. [`18-round-al-progress.md`](18-round-al-progress.md) — Round AL inventory (AE469-AE481): canvas-shared completion (Genie + Continuum + Mirror + Echo + Lumen interactions + Vault + url-ttl + now-card-lifecycle + upcoming-trip → 35 total modules) + cross-package lifecycle integration spec + a11y sweep + url-ttl + palette edge specs + shape-gate spec.
21. [`19-round-am-progress.md`](19-round-am-progress.md) — Round AM inventory (AE483-AE487): Phase 1 + Phase 2 API surface shape-gates (catches any silent barrel rename) + data-flow doc §8 refresh + component catalog refresh (35-module canvas-shared inventory grouped into 11 buckets).
22. [`20-round-an-progress.md`](20-round-an-progress.md) — Round AN inventory (AE488-AE490): Phase 3 barrel + shape-gate (closes the three-layer barrel coverage) + canvas-shared invariants spec (21 mathematical laws: sphere-surface, unit-vector, monotonicity, bounds, etc.).
23. [`21-round-ao-progress.md`](21-round-ao-progress.md) — Round AO inventory (AE491-AE495): canvas-shared own behavioural specs for 5 high-value modules (url-ttl + genie-state FSM + pulse-hold-to-talk + lumen-pinch + vault-checkout) so the Phase 4 native port can re-export and verify the math without the web suite. jest 33 → 142.
24. [`22-round-ap-progress.md`](22-round-ap-progress.md) — Round AP inventory (AE497-AE503): workflow-driven behavioural specs for 7 more modules (continuum-state + weather-simulation + lumen-museum + vault-sample-prices + genie-recorder + mirror-globe + echo-feed) — 12 of 35 canvas-shared modules now have own behavioural coverage. jest 142 → 394.
25. [`23-round-aq-progress.md`](23-round-aq-progress.md) — Round AQ inventory (AE505-AE511): workflow-driven behavioural specs for 7 more modules (lifecycle-camera + continuum-sigil + lumen-cloud + lumen-strategies + atlas-orbs + destination-coords + vault-glyphs) — 19 of 35 canvas-shared modules now have own behavioural coverage. jest 394 → 690.
26. [`24-round-ar-progress.md`](24-round-ar-progress.md) — Round AR inventory (AE513-AE517): **first real Phase 4 code**. The 3 blocking decisions locked at recommended defaults (Tamagui-out / R3F-for-depth+Skia-for-flat / single-binary), and the three cross-cutting foundation packages scaffolded (`@app/aether-core-native` + `@app/aether-canvas-native` + `@app/aether-audio-native`) — each with shape-gate specs (6 + 10 + 15 = +31 tests).
27. [`25-round-as-progress.md`](25-round-as-progress.md) — Round AS inventory (AE518-AE523): **Tamagui-out** implementation. 12 apps/mobile files rewritten via workflow (24 agents in a parallel read→rewrite pipeline) — every Tamagui primitive replaced with plain RN. Tamagui deps dropped from package.json (-124 transitive packages from lockfile). apps/mobile typecheck clean.
28. [`26-round-at-progress.md`](26-round-at-progress.md) — Round AT inventory (AE524-AE529): **first Aether mobile surface live**. Wires `@app/aether-canvas-shared` into apps/mobile, installs `@shopify/react-native-skia`, builds + mounts `<AetherPulseGlow/>` as a 64-px corner glow persistent across navigation. Plus operator scaffolding (eas.json feature flag, .env.example, aether mobile README). Surface coverage 1/10.
29. [`27-round-au-progress.md`](27-round-au-progress.md) — Round AU inventory (AE530-AE533): **second mobile surface — Continuum sigil (Skia)**. Adds canvas-shared `sigilCellRects`/`sigilPixelSize` layout helper (+35 tests), builds `<AetherContinuumSigil/>`, and wires `useReducedMotionNative` into the Pulse glow (OS Reduce Motion respect). Surface coverage 2/10. canvas-shared jest 725.
30. [`28-round-av-progress.md`](28-round-av-progress.md) — Round AV inventory (AE534-AE538): **first R3F-native surface — Drift**. Installs the R3F-native stack (three + fiber@8 + expo-gl + expo-three), adds canvas-shared `ambientFieldPositions`/`sunDiskRotation` math (+20 tests), builds `<AetherDriftScene/>` mounting a real `<Canvas>`, and routes it at `/aether/drift` behind the feature flag. Both renderer paths now proven. Surface coverage 3/10. canvas-shared jest 745.
31. [`29-round-aw-progress.md`](29-round-aw-progress.md) — Round AW inventory (AE539-AE542): **Atlas (second R3F surface) + every surface routed**. Builds `<AetherAtlasScene/>` (orb cloud via `layoutOrbsForTrip`), routes Atlas + Continuum at `/aether/*` with a shared `SAMPLE_LEH_TRIP` fixture, and turns the explore-tab banner into an "Aether preview" section. Surface coverage 4/10; both renderer paths now carry two surfaces each.
32. [`30-round-ax-progress.md`](30-round-ax-progress.md) — Round AX inventory (AE543-AE547): **two surfaces in one round — Compass + Vault**. Builds `<AetherCompassScene/>` (bird-mode rose via `bearingPositionOnRing`) + `<AetherVaultScene/>` (price-glyph ring via `glyphRingPosition`/`glyphFloatY`/`glyphSphereScale`), each with a live route. Surface coverage 6/10; both reuse already-spec'd math so canvas-shared is unchanged.
33. [`31-round-ay-progress.md`](31-round-ay-progress.md) — Round AY inventory (AE548-AE553): **Lumen + Echo**. Builds `<AetherLumenScene/>` (photo cloud via `layoutPhotoCloud`) + `<AetherEchoScene/>` (social-feed depth stack via `echoCardY`/`echoCardScale`/`echoCardOpacity`), each with a sample fixture + live route. Surface coverage 8/10 — only Genie + Mirror remain.
34. [`32-round-az-progress.md`](32-round-az-progress.md) — Round AZ inventory (AE554-AE558): **Genie + Mirror = 10/10 surfaces live**. Builds `<AetherGenieScene/>` (R3F particle swirl + genie-state FSM mic overlay) + `<AetherMirrorScene/>` (last Skia surface — flat audit strip via `liveAuditRows`/`auditGlyphColor`/`auditRowYProgress`), each routed. **Phase 4 surface-breadth complete.** Remaining work is depth + real data + the EAS device build.
35. [`33-round-ba-progress.md`](33-round-ba-progress.md) — Round BA inventory (AE559-AE562): **Phase 4 depth begins**. Echo's auto-advance becomes a real gesture-handler swipe (`echoSwipeDirectionFromDelta` → `echoActionForSwipe` → `nextEchoIndex`); Vault's glyph tap opens a working checkout panel driven by the vault-checkout FSM (`canSubmitCheckout` + `checkoutDisabledReason` + simulated submit). No new surfaces — existing ones get real interaction.
36. [`34-round-bb-progress.md`](34-round-bb-progress.md) — Round BB inventory (AE563-AE566): more depth. `useDeviceHeading` (expo-location `watchHeadingAsync`) drives the Compass needle from the real device sensor — first sensor-driven surface; Atlas orbs get tap-to-focus + a place-card overlay (mirrors the Vault tap pattern). Five of seven non-trivial surfaces now have real interaction.
37. [`35-round-bc-progress.md`](35-round-bc-progress.md) — Round BC inventory (AE567-AE569): structural cleanup + depth. The Warm Italian palette consolidates into one `apps/mobile/src/aether/palette.ts` module (9 scenes migrated — the seam for the eventual palette-context swap); Lumen gets tap-to-inspect (plane → photo detail card). Six of seven non-trivial surfaces now have real interaction.
38. [`36-round-bd-progress.md`](36-round-bd-progress.md) — Round BD inventory (AE570-AE577): **adversarial pre-device audit**. A 21-agent review→verify workflow found + confirmed 7 runtime bugs `tsc` can't see (Lumen FrontSide cull, Genie double-tap FSM stall, Pulse 60fps re-render, Pulse mount not flag-gated, Echo hint-timer leak, Mirror frozen clock, Compass permission-when-disabled) — all fixed. Catching them before the EAS device build.
39. [`37-round-be-progress.md`](37-round-be-progress.md) — Round BE inventory (AE578-AE581): **first Phase-4 finish round**. Mirror gets tap-to-expand (row → un-truncated summary + kind/emit-time/id) — **7/7 non-trivial surfaces now interact**. The Vault/Atlas/Lumen tap pattern DRYs onto one `useR3FSelection<T>` hook. The palette module hardens into a typed seam (`AETHER_PALETTE_SLOTS` + `resolveAetherPaletteSlots`); the live `@app/aether-core-native` context swap is **deferred** (React-18/19 `@types` clash + needs a `<SurfaceManagerProvider>` mobile mounts none of) with the 3-step swap recipe documented in `palette.ts`.

## What we reuse from 1.0

- **API** (`apps/api`, 193 endpoints across 19 modules) — every route stays.
- **`@app/sdk`** — regenerated on schema change; consumed unchanged.
- **ai-service** — every endpoint reused; new caching + persona-embedding layer adds on top.
- **Workers** — `notification-worker` / `media-service` / `crawler-worker` + (new) `pdf-worker`.
- **Auth + RBAC + audit log + Slack notifier** — all preserved.
- **Observability** (Sentry / OTel / Honeycomb / Grafana / SLOs).
- **`@app/shared-types` Zod schemas** — Aether forms validate via the same contracts.

## What we discard

Every `.tsx` in `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/mobile/app/**`, `apps/mobile/src/**`. Tamagui, the 11 generic UI primitives, the Tailwind utility soup — all of it goes. Reference implementations (auth flows, form patterns, token storage) inform Aether's equivalents but no code is copy-pasted.

## Decisions — locked 2026-05-28

All eight answered in [`06-decisions.md`](06-decisions.md). Summary:

| #   | Decision       | Locked answer                                                 |
| --- | -------------- | ------------------------------------------------------------- |
| 1   | Aspiration     | Phase 1 trip-loop (~6 months solo) as v2 launch               |
| 2   | Team           | Solo founder + composer contract                              |
| 3   | Brand          | **Warm Italian tactile** (terracotta / ochre / olive / cream) |
| 4   | Audio          | Mandatory, respects OS mute + reduced-motion + opt-out        |
| 5   | Premium gating | Genie / Predictor / Compass Eye / Lumen PDF                   |
| 6   | Launch order   | Web-first Phase 1-2, mobile Phase 4                           |
| 7   | Continuum      | Apple Continuity + WebTransport with clean fallback           |
| 8   | AR commitment  | Defer Compass Eye to Phase 5                                  |

## See also

- [`CLAUDE.md`](../../CLAUDE.md) — system rules; Aether obeys all of them (rule-12 token storage, hex DI, no `any`, no `console.log`, etc.).
- [`docs/audit/web-feature-matrix-2026-05-26.md`](../audit/web-feature-matrix-2026-05-26.md) — what 1.0 actually has (52% complete) and informs Aether's surface map.
- [`docs/audit/mobile-2026-05-26.md`](../audit/mobile-2026-05-26.md) — Z1 mobile audit; informs the D-series gating.
- [`travel-app-playbook.md`](../../travel-app-playbook.md) — the 1.0 book.
- [`PROGRESS.md`](../../PROGRESS.md) — Aether scoped here; Aether prompts will live in `travel-app-prompts.md` when Phase 0 begins.
