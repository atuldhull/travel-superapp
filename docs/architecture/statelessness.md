# Statelessness — what the api can and can't hold in memory

> **Installed by [Q8]** of the Scale-readiness 3→10 series. Companion to [`docs/runbooks/redis-cluster-posture.md`](../runbooks/redis-cluster-posture.md) + [`docs/runbooks/database-pooling.md`](../runbooks/database-pooling.md) + [`apps/api/test/architecture.fitness.spec.ts`](../../apps/api/test/architecture.fitness.spec.ts).

Horizontal scaling — running 2 / 5 / 50 api machines at once — only works if every machine handles every request the same way. The moment a single machine "remembers" something the others don't know, you have a sticky-session problem: a session pinned to machine A means losing it when A restarts, or serving stale data when the load balancer rolls the user to machine B.

The api is **fully stateless** by design. This doc codifies what that means in practice + the fitness invariants that enforce it.

## The rule

**Mutable, per-request state lives in Postgres, Redis, R2, or the request body. Never in the api process's heap.**

This applies to:

- **Sessions / refresh tokens** — in `Session` (Postgres) + JWT blacklist (Redis).
- **Rate-limit counters** — in Redis (`travel-<env>:rate:…` keys).
- **Caches** — in Redis via [`@app/cache`](../../packages/cache/) / `TypedRedisCache`.
- **Feature flags** — in Postgres (`FeatureFlag` table) with a Redis read-through cache.
- **Pending workflows** — in BullMQ ([`@app/jobs`](../../packages/jobs/)) — never `setTimeout(() => …, 30_000)`.

Read-only, **immutable seed data** in process memory is fine and encouraged:

- **Country / locale tables** — see `safety/application/get-country-primer.use-case.ts` (`PRIMERS: ReadonlyMap<...>`).
- **Static configuration** loaded once at boot — see `payments/application/sync-subscription.use-case.ts` (`PREMIUM_STATUSES: ReadonlySet<...>`).
- **Lookup constants** — `VALIDATED_ARG_TYPES` in zod-validation.pipe.ts.

The line: if you'd mutate it during request handling, it doesn't live in the heap.

## Fitness invariants (in [`architecture.fitness.spec.ts`](../../apps/api/test/architecture.fitness.spec.ts))

The spec mechanically enforces the rule across `apps/api/src/**/*.ts`:

| Rule                                                                                                  | What it catches                                                                              | Allow-list                                                         |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| No module-level mutable `Map`/`Set`/`WeakMap`/`WeakSet` — must be `ReadonlyMap` / `ReadonlySet` typed | `const cache = new Map<string, T>()` at module scope                                         | `common/cache/typed-redis-cache.ts` (per-process metrics registry) |
| Every Redis-owning class has `OnModuleDestroy` + `.quit()` ([M1])                                     | A new class holding an ioredis instance without graceful shutdown                            | none                                                               |
| `setInterval` owners must `clearInterval` ([M1])                                                      | Orphan timers that leak across hot-reloads + survive process death without releasing the ref | none                                                               |
| Every `*.scheduler.ts` gates on `NODE_ENV === 'test'` ([M1])                                          | A 24h scheduler running during integration tests + leaking timer handles                     | none                                                               |
| No `redis.keys(...)` calls ([Q2])                                                                     | `KEYS *` blocking the single-thread Redis server + breaking cluster mode                     | none                                                               |
| No `console.*` in src — use `@app/logger`                                                             | Logs that escape the structured pipeline (no trace correlation, no log-level gating)         | none                                                               |
| No `as any` casts in src                                                                              | Type-erasure pretending the unknown is fine — usually a sign of mis-shaped DI                | none                                                               |

CI runs these on every PR via the `arch` job in [`ci.yml`](../../.github/workflows/ci.yml).

## What ALSO has to be stateless (but isn't fitness-enforced today)

The static rules cover the worst offenders. These slip through the static check; reviewer eyes catch them:

- **In-memory websocket rooms**. We don't run websockets yet; when we do, a Socket.IO Redis adapter (or BullMQ-driven pub/sub) is the right shape, not in-process room state.
- **In-memory pending request queues**. If a route ever needs to "wait for the next event from another tenant," it goes through Redis Streams, never `new EventEmitter()` at module scope.
- **In-memory dedup / debounce maps**. The classic "don't send the same email twice in 60s" lookup should be a `SETNX` with a TTL, not an in-process Map.
- **In-memory feature-flag overrides**. Per-machine "force this flag on for staging" is fine for one-off ops; if it's tooling, it's an admin route that writes to the `FeatureFlag` table.

When a future reviewer is unsure, the question is: **"if I doubled the machine count tomorrow, would this still work?"** If no, it's stateful and needs to move to Redis or Postgres.

## How to add a new stateful primitive

1. Identify the data shape: ephemeral (Redis), durable (Postgres), media (R2), bursty job (BullMQ).
2. If ephemeral, decide between cache (`TypedRedisCache`) or rate-limit (`@app/rate-limit`) — they have different TTL + eviction semantics.
3. If durable, add a Prisma model — runs through [Q4 ERD drift gate](../../docs/runbooks/database-pooling.md).
4. Write the use case importing the right primitive; the fitness gate either passes or yells.
5. Confirm `pnpm --filter=api test -- --testPathPattern=architecture.fitness` is green.

## How to allowlist a known-safe stateful site

Rare. The bar is "the in-process state is per-machine BY DESIGN, AND has no read or write requirement that crosses machines." Example: `TypedRedisCache`'s `static instances = new Set<...>()` is a registry the metrics walker iterates ONCE per machine — Prometheus scrapes each machine separately, so per-machine state is the intended shape.

To add to the allowlist:

1. Add a comment block explaining "this is per-process by design BECAUSE …".
2. Add the file path to `ALLOWED_STATEFUL_MODULES` in the fitness spec.
3. Reference this doc in the PR.

The allowlist is meant to be ~3 entries forever, not a place to silence the linter.

## See also

- [`apps/api/test/architecture.fitness.spec.ts`](../../apps/api/test/architecture.fitness.spec.ts) — the gate
- [`docs/runbooks/redis-cluster-posture.md`](../runbooks/redis-cluster-posture.md) — what cluster mode demands
- [`docs/runbooks/database-pooling.md`](../runbooks/database-pooling.md) — Postgres connection budget under horizontal scale
- [`packages/jobs/README.md`](../../packages/jobs/README.md) — the right place for long-running work
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — what scale this is in service of
