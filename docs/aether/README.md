# Aether — TravelSuperApp 2.0 frontend

> **Status: scoped, not started.** 26 commits of S-series 1.0 work land first (per the post-compact autopilot order); Aether Phase 0 begins after C2 + D1-D5 are shipped.
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

## Decisions blocking Phase 0

See [`04-sequencing.md`](04-sequencing.md#decisions) — eight decisions need answers before any Aether code lands:

1. Aspiration level (Phase 1 in ~4 months vs Phase 4 in ~14 months)
2. Team posture (solo / contract designer+composer / hire 2-3 engineers)
3. Brand language (serene-Japanese / warm-Italian / Scandinavian-precise / Afrofuturist)
4. Audio mandatory vs opt-in
5. Premium gating (which surfaces gate behind subscription)
6. Web-first vs mobile-first launch (recommendation: web-first Phase 1-2)
7. Continuum scope (Apple Continuity vs pan-OS WebTransport)
8. AR commitment (Compass Eye AR mode in Phase 3 vs Phase 5)

## See also

- [`CLAUDE.md`](../../CLAUDE.md) — system rules; Aether obeys all of them (rule-12 token storage, hex DI, no `any`, no `console.log`, etc.).
- [`docs/audit/web-feature-matrix-2026-05-26.md`](../audit/web-feature-matrix-2026-05-26.md) — what 1.0 actually has (52% complete) and informs Aether's surface map.
- [`docs/audit/mobile-2026-05-26.md`](../audit/mobile-2026-05-26.md) — Z1 mobile audit; informs the D-series gating.
- [`travel-app-playbook.md`](../../travel-app-playbook.md) — the 1.0 book.
- [`PROGRESS.md`](../../PROGRESS.md) — Aether scoped here; Aether prompts will live in `travel-app-prompts.md` when Phase 0 begins.
