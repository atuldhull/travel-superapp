# Aether — TravelSuperApp 2.0 frontend

> **Status: Phase 1 + 2 + 3 scaffolds shipped (2026-06-01).** All ten surfaces from `02-surfaces.md` are scaffolded behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` except **Compass Eye AR** (deferred to Phase 5 per decision #8). Phase 3 closeout at [`14-phase3-closeout.md`](14-phase3-closeout.md); the Phase 4 mobile-parity plan is at [`15-phase4-plan.md`](15-phase4-plan.md). Backend b-slices (Whisper STT, CLIP, ML-Kit, Stripe, WebTransport feed, live admin SDK, presence stream) remain owed. Brand language locked to **Warm Italian tactile**.
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
