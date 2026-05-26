# Runbook — Database connection pooling

> **Installed by [Q1]** of the Scale-readiness 3→10 series. Companion to [supabase-deploy.md](supabase-deploy.md) + [backups-dr.md](backups-dr.md).
>
> The api connects to **two** Postgres URLs in staging and prod:
>
> - `DATABASE_URL` → through **PgBouncer transaction-mode** (port 6543). The hot request path.
> - `DIRECT_URL` → bypasses the pooler (port 5432). For Prisma migrate + introspection only.
>
> Local dev defaults to `DATABASE_URL` only; the pooled posture is opt-in via the `pool` compose profile.

## Why two URLs

Postgres' `max_connections` is a hard cap (Supabase free tier: 60, Pro: 200, sized for the instance). A naive `connection per user-request` posture exhausts that cap at ~30 concurrent users. The memory entry [`postgres-max-connections-runinband`](../../../C:/Users/atuld/.claude/projects/c--Users-atuld-dev-testing/memory/feedback_postgres_max_connections_runinband.md) captures exactly this — even the test suite hit the cascade.

PgBouncer fixes it by sitting between the client (api) and the database:

```text
NestJS api (1000s of clients)
        │
        ▼
PgBouncer :6543  ──── transaction-mode pool (default_pool_size = 25)
        │
        ▼
Postgres :5432   ──── only ~25 physical backends in use
```

**Transaction mode** — the magic word. PgBouncer hands a backend to a client for the duration of ONE transaction, then returns it to the pool. The next transaction gets whatever backend is free. Result: 1000 clients can share 25 backends as long as no single transaction holds for long.

The cost: any feature that needs **session state** breaks. Prepared statements, advisory locks, `LISTEN/NOTIFY`, `SET LOCAL`, temp tables. Hence the second URL.

## The two URLs — what each is for

### `DATABASE_URL` (hot path · port 6543 · pooled · `?pgbouncer=true`)

- Connects through the pooler.
- Carries `?pgbouncer=true&connection_limit=1` so Prisma client disables prepared statements + uses one connection per worker.
- Used by `apps/api`, `apps/web` Server Actions, every worker (notification, media, crawler), and the ai-service.
- **Never** used for `prisma migrate ...` — that breaks under transaction-mode.

Example:

```sh
# Supabase Pro form (port 6543 + ?pgbouncer=true is mandatory):
DATABASE_URL='postgresql://postgres.<project>:<pw>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'

# Local (with compose profile `pool` enabled):
DATABASE_URL='postgresql://travel:travel_dev@127.0.0.1:6543/travel_dev?pgbouncer=true&connection_limit=1'
```

### `DIRECT_URL` (migrations · port 5432 · no pooler)

- Connects to the database directly, bypassing PgBouncer.
- Used by `prisma migrate deploy`, `prisma db push`, `prisma db pull`, `prisma migrate resolve`, and `prisma generate` with `--data-proxy=false`.
- Used by integration test schema isolation (per-worker `?schema=test_w${JEST_WORKER_ID}` from [L1]).
- Optional in dev — falls back to `DATABASE_URL` automatically (Prisma reads `directUrl` and defaults to `url` if unset).

Example:

```sh
DIRECT_URL='postgresql://postgres.<project>:<pw>@aws-0-us-east-1.compute.amazonaws.com:5432/postgres'
```

## Local-dev posture

Default (port 5432, no pooler — fastest to get started, fine for a single dev process):

```sh
pnpm dev:up
# DATABASE_URL=postgresql://travel:travel_dev@127.0.0.1:5432/travel_dev
```

Opt-in pooled posture — useful when running the full integration suite or stress-testing locally:

```sh
docker compose -f infra/docker-compose.yml --profile pool up -d
# Then in apps/api/.env.local, swap to the 6543 form:
# DATABASE_URL=postgresql://travel:travel_dev@127.0.0.1:6543/travel_dev?pgbouncer=true&connection_limit=1
# DIRECT_URL=postgresql://travel:travel_dev@127.0.0.1:5432/travel_dev
```

After the swap, `pnpm --filter=api dev` runs through PgBouncer; `pnpm --filter=api db:migrate:deploy` still uses the direct URL.

## Common failure modes

### "prepared statement \"sN\" already exists"

You forgot `?pgbouncer=true` on `DATABASE_URL`. Prisma is sending prepared statements; PgBouncer has handed the backend to a new transaction; the second transaction sees the stale statement.

**Fix:** add `?pgbouncer=true&connection_limit=1` to the pooled URL. Restart the api.

### "advisory lock cannot be acquired in transaction-mode"

You ran `prisma migrate ...` against `DATABASE_URL`. Prisma's migration engine uses advisory locks to serialise concurrent migrations; advisory locks need session state.

**Fix:** ensure `DIRECT_URL` is set and that `prisma migrate` is reading from it. Prisma auto-uses `directUrl` from `schema.prisma`.

### "too many clients already"

You ran out of physical backends. Either:

- Increase `default_pool_size` in `infra/pgbouncer/pgbouncer.ini` (local) or upgrade the Supabase tier (prod).
- Reduce `DATABASE_POOL_MAX` per process — the app shouldn't open more than ~10 transactions in flight.
- Look for long-running transactions blocking the pool (`SELECT * FROM pg_stat_activity WHERE state = 'active' AND now() - xact_start > INTERVAL '30 seconds'`).

### Migrations hang in CI

Bootstrap-smoke uses `DATABASE_URL` (port 5432, no pooler) and is fine. But staging / prod CI must set BOTH `DATABASE_URL` and `DIRECT_URL` from Doppler. If `DIRECT_URL` is missing, Prisma falls back to `DATABASE_URL` which IS the pooled URL → migrations hang on the advisory lock.

**Fix:** confirm both Doppler secrets exist before `flyctl deploy`. The deploy workflow ([.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)) reads `DIRECT_URL` as a required secret.

## When to upgrade the pool size

- **Supabase free tier:** `max_connections = 60`. Pooler default `pool_size = 15`. Headroom = ~45 backends for migrations + admin queries + replication. Good for ~150-300 concurrent active requests.
- **Supabase Pro ($25/mo):** `max_connections = 200`. Pooler `pool_size = 50`. Headroom = ~150 backends. Good for ~1500-3000 concurrent active requests.
- **Supabase Team ($599/mo):** `max_connections = 400+`. Pooler `pool_size = 100`. Good for the 10k RPS load profile in [docs/runbooks/load-testing.md](load-testing.md).

A request is "active" while it holds a transaction — typically 10-200 ms. Concurrent active requests ≈ RPS × avg-transaction-duration-sec. At 1k RPS with 50 ms avg-tx, that's ~50 active — the free tier suffices.

## Operator-owed

1. **Supabase Pro upgrade** ($25/mo) — bumps `max_connections` from 60 to 200 + enables PITR (also unlocks the RPO ≤ 60s target from [backups-dr.md](backups-dr.md)).
2. **Doppler** — set `DIRECT_URL` in every non-local environment. Required by Prisma migrate.
3. **CI deploy gate** — `.github/workflows/deploy.yml` must fail if `DIRECT_URL` is unset for the target environment.

## Read replicas ([R4])

`PrismaService` exposes a `$readReplica()` accessor. When `DATABASE_URL_READONLY` is set, it returns a second `PrismaClient` wired to that URL; otherwise it returns the primary client. Either way the returned shape is `PrismaClient`, so call sites don't branch on env.

```ts
// In a use-case that doesn't need read-after-write consistency:
async listPublishedTrips(): Promise<Trip[]> {
  return this.prisma.$readReplica().trip.findMany({
    where: { status: 'published' },
    take: 100,
  });
}

// In a use-case that DOES need consistency (read your own write):
async upsertAndReadBack(input: ...): Promise<Trip> {
  const trip = await this.prisma.trip.upsert({ ... });
  // Same client — no replica lag risk.
  return this.prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
}
```

**When to use `$readReplica`:**

- Hot public reads (`/api/v1/places/featured`, `/api/v1/feed/public`, published trip pages).
- Reads scoped to a single region during multi-region operation (the replica lives in the surviving region per [multi-region-failover.md](multi-region-failover.md)).
- Background workers doing read-mostly scans (analytics rollup, recrawl planner).

**When NOT to use:**

- Any read inside `prisma.$transaction(...)` — the replica isn't part of the transaction.
- Read-after-write of the same row — replica lag (typically 50-500 ms on Supabase Team) means stale data.
- Writes — always primary.
- Auth flows — never read a session from a replica; lag would let a logged-out user pass a check the primary already invalidated.

Supabase Pro doesn't include replicas; Supabase Team ($599/mo) does. The runbook above is operator-owed for activation: provision the replica in the Supabase dashboard, copy the read URL, set `DATABASE_URL_READONLY` in Doppler, redeploy.

## See also

- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — datasource block with `directUrl`
- [`apps/api/src/common/db/prisma.service.ts`](../../apps/api/src/common/db/prisma.service.ts) — `$readReplica()` accessor + lifecycle
- [`packages/config/src/schema.ts`](../../packages/config/src/schema.ts) — `DATABASE_URL` + `DIRECT_URL` + `DATABASE_URL_READONLY` Zod fields
- [`infra/pgbouncer/pgbouncer.ini`](../../infra/pgbouncer/pgbouncer.ini) — local PgBouncer config (transaction mode)
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) — `pgbouncer` service under profile `pool`
- [`docs/runbooks/multi-region-failover.md`](multi-region-failover.md) — the failover path the replica unlocks
- [`docs/runbooks/db-partitioning.md`](db-partitioning.md) — when read replicas aren't enough ([R5])
- [Prisma — PgBouncer + Prisma](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Supabase — connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase — read replicas](https://supabase.com/docs/guides/platform/read-replicas)
