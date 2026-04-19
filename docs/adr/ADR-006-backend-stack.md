# ADR-006 — Backend stack: NestJS 11 + Fastify + Prisma 5 + Python 3.12/FastAPI + BullMQ

- **Status:** Accepted
- **Date:** 2026-04-19
- **Prompt:** `[II.8.2]`
- **Playbook reference:** §8.2

## Context

Playbook §6 commits TravelSuperApp to a modular monolith ([ADR-001](./ADR-001-modular-monolith.md)) with 17 bounded contexts + 4 extracted services ([ADR-002](./ADR-002-service-extraction-triggers.md)). The backend has to host enterprise DI (17 modules need clean seams), typed ORM (Postgres + PostGIS + pgvector), a Python ML sidecar (Node can't run NLLB / Whisper natively), and queue-driven async work (notifications / media / crawler / transactional outbox).

This ADR locks the backend runtime choices so feature authors don't relitigate "Express vs NestJS" or "Drizzle vs Prisma" in every PR.

## Decision drivers

- **Enterprise DI + lifecycle.** 17 modules × 4 layers (domain / app / infra / interface) means we need real DI, guards, interceptors, lifecycle hooks. Rules out micro-frameworks (Express, Koa, plain Fastify).
- **Hot-path throughput.** p95 < 300 ms for reads (Playbook §10). Rules out frameworks that add meaningful per-request overhead.
- **Typed DB access.** Postgres + PostGIS + pgvector. We want end-to-end types from schema to controller with no `any`. Raw SQL is OK for geo/vector paths; the rest of the code needs a real ORM.
- **ML without porting models.** NLLB, Whisper, DistilBERT, embedding generation are all native Python ecosystems. Porting them to ONNX-in-Node is possible but the maintenance cost is real; a Python sidecar is the path of least regret.
- **Queues + cron in one dep.** Notifications, media, crawler all need durable queues + scheduled jobs. Running Kafka for this at MVP is a yak-shave (see [ADR-003](./ADR-003-event-backbone.md)).
- **Small team.** 1–3 engineers. No frameworks that need a dedicated platform person.

## Considered choices (each locked, each with one rejected alternative)

### 1. Node framework — **NestJS 11**

**Chosen.** Module system fits the 17-bounded-context layout perfectly (one NestJS module per context). Decorator-based DI + guards + interceptors + pipes map cleanly onto clean/hex layers: controllers call use-cases (`@Injectable()` providers) which use ports (Nest DI tokens). CASL integration for authorization ([III.13.3]) is first-class. OpenAPI + Swagger UI are zero-config via `@nestjs/swagger`.

**Rejected alternative: Plain Fastify + manual DI (e.g. tsyringe).** Faster boot, lower memory, less "magic". But then we hand-roll a module system, guard layer, interceptor layer, and request-lifecycle hooks. At 17 contexts that's a real chunk of infra we'd write, test, and debug — time that doesn't make the product better. For a small API (1-3 modules) this would win. For us, Nest pays off.

### 2. HTTP adapter — **Fastify** (via `@nestjs/platform-fastify`)

**Chosen.** Fastify is 2–3× faster than Express per-request; `@fastify/helmet` + `@fastify/cors` already slotted into our security perimeter ([IV.18.1.17]); plugin system maps cleanly onto per-request nonces, schema-based input validation, and the Nest filter/pipe chain. Native `app.inject()` makes integration tests fast + parallel-safe (no real port).

**Rejected alternative: Express (Nest default).** Proven, huge ecosystem, zero learning curve. But Express is the slower default, its middleware system doesn't compose as cleanly with Nest's pipe/filter chain, and its plugin ecosystem (helmet-express, cors-express) has known per-request overhead we'd pay 24/7. The switching cost inside Nest is one line (`FastifyAdapter` vs `ExpressAdapter`) — we take the win.

### 3. ORM — **Prisma 5**

**Chosen.** Type-safe client generated from `schema.prisma`; first-class support for Postgres extensions (postgis, vector, pg_trgm, pgcrypto) via the preview extensions block (Playbook §12.5); migrations with shadow-DB drift detection; `$queryRaw` escape hatch for PostGIS / pgvector queries that Prisma can't type ([Playbook §12.2](../../travel-app-playbook.md)). Prisma Studio is a genuine daily-use debugger for non-engineers (admin / support).

**Rejected alternative: Drizzle.** SQL-shaped DSL, no codegen step, lighter runtime. If we were starting in 2024 it would be a real contender. But Drizzle's PostGIS / pgvector story is DIY (`sql<T>\`\``everywhere), its migration tooling is younger, and its ecosystem integrations (observability, Nest module) are thinner. For the types we want (relations + nested includes with zero`any`) Prisma is still tighter. Revisit if Drizzle's PostGIS integration matures.

### 4. AI sidecar runtime — **Python 3.12 + FastAPI + Ray Serve**

**Chosen.** NLLB-200, Whisper, DistilBERT, and most crowd-prediction models are native Python. FastAPI is the right async HTTP shape for ML endpoints; Ray Serve handles per-model replica scaling + back-pressure so one Whisper stream can't starve the translate endpoint. Contract lives in [`docs/services/ai-service/contract.md`](../services/ai-service/contract.md) — gRPC primary, REST secondary.

**Rejected alternative: ONNX Runtime in Node.** Would let us ditch the Python dep entirely, run one language across the whole backend. But: quantised ONNX models lose accuracy on long-form translation (NLLB) and the streaming story (Whisper) is meaningfully harder to match; every model upgrade requires a re-export pipeline that has its own maintenance tax. A Python sidecar is the correct isolation boundary for "things we didn't write, shipped by upstream research teams".

### 5. Queues + scheduling — **BullMQ on Redis**

**Chosen.** Same Redis we already run for cache + sessions + Streams ([ADR-003](./ADR-003-event-backbone.md)) — zero new infra. Durable queues with retries, exponential backoff, DLQ support, per-queue concurrency, repeatable (cron) jobs. NestJS integration via `@nestjs/bullmq`. Consumed by `notification-worker` + `media-service` + `crawler-worker` as documented in their contracts. BullBoard gives ops a UI without running anything extra.

**Rejected alternative: Temporal.** More powerful — durable workflows, deterministic replay, first-class retries, versioned workflow code. For a product with complex multi-step orchestrations (payment → escrow → notification sequences) it would win. But Temporal is a separate service cluster (history server + worker + UI + Postgres), a big ops step up from a single Redis instance. We accept the BullMQ ceiling for now; extracting to Temporal later is a worker-by-worker migration, not a re-architecture. The migration trigger is "we need deterministic replay for billing flows" — not MVP scope.

## Summary

| #   | Layer               | Chosen                            | Rejected (one)           |
| --- | ------------------- | --------------------------------- | ------------------------ |
| 1   | Node framework      | NestJS 11                         | Plain Fastify + tsyringe |
| 2   | HTTP adapter        | Fastify                           | Express                  |
| 3   | ORM                 | Prisma 5                          | Drizzle                  |
| 4   | AI sidecar runtime  | Python 3.12 + FastAPI + Ray Serve | ONNX Runtime in Node     |
| 5   | Queues + scheduling | BullMQ on Redis                   | Temporal                 |

## Consequences (binding)

- **Every `apps/api` module is a NestJS module.** No Express sub-apps, no raw Fastify routes outside the adapter. New HTTP endpoints go through Nest controllers or they don't ship.
- **Every DB read/write goes through Prisma or `GeoQueries`.** Raw `$queryRaw` is reserved for PostGIS / pgvector paths (Playbook §12.2 rule — CLAUDE.md rule 11). Ad-hoc raw SQL elsewhere fails review.
- **ai-service is mTLS-gated in staging/prod and never reachable from the public internet.** It's an internal sidecar, not a public endpoint. Contract: [`docs/services/ai-service/contract.md`](../services/ai-service/contract.md).
- **BullMQ queues are namespaced per environment via `@app/cache`** — `travel-dev:queue:notifications.send.push`, `travel-prod:queue:...` etc. Cross-env spill is a deploy-time assertion.
- **No direct Express/Koa middleware** in `apps/api`. Fastify hooks via `app.getHttpAdapter().getInstance()` are the escape hatch when a Nest interceptor isn't a fit (e.g. Permissions-Policy on every response — see [IV.18.1.17]).
- **Temporal-extraction trigger.** If a workflow demands deterministic replay (billing reconciliation, escrow state machine), write a superseding ADR for Temporal adoption of THAT specific workflow. Don't migrate the whole queue stack as a reflex.

## Re-evaluation triggers

This ADR is reviewed if any of the following becomes true:

- NestJS 12 introduces a breaking change we can't backwards-compat absorb (bump to a superseding ADR then, not a silent major upgrade).
- Prisma's PostGIS / pgvector integration regresses meaningfully, OR Drizzle reaches feature parity with first-class geo / vector support.
- The ai-service surface grows beyond "ML endpoints" into request-handling logic — at which point the Node/Python split becomes a liability, and we either reel it back into Node (ONNX) or split the Python surface into a bigger Python app.
- A billing / escrow flow requires deterministic replay — Temporal adoption for that specific flow, not a wholesale switch.
- Fastify's plugin maintenance slows materially (unlikely; Fastify 5 is stable).

## Links

- Playbook §8.2 (Backend table).
- Sibling ADRs: [ADR-005 Frontend stack](./ADR-005-frontend-stack.md), [ADR-007 Data layer](./ADR-007-data-layer.md) (pending), [ADR-008 AI stack](./ADR-008-ai-stack.md) (pending).
- [ADR-001](./ADR-001-modular-monolith.md) — the monolith this stack hosts.
- [ADR-002](./ADR-002-service-extraction-triggers.md) — why ai-service is the one Python carve-out.
- [ADR-003](./ADR-003-event-backbone.md) — Redis Streams (same Redis BullMQ rides on).
- [`docs/services/ai-service/contract.md`](../services/ai-service/contract.md) — sidecar contract.
- [`docs/packages/manifest.md`](../packages/manifest.md) — `@app/events`, `@app/cache`, `@app/ratelimit` all depend on this ADR's Redis choice.
- [NestJS](https://docs.nestjs.com/) · [Fastify](https://fastify.dev/) · [Prisma](https://www.prisma.io/) · [FastAPI](https://fastapi.tiangolo.com/) · [BullMQ](https://docs.bullmq.io/).
