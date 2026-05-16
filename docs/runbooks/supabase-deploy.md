# Runbook: Supabase database deploy (the supervised DB step)

> Companion to [`fly-deploy.md`](./fly-deploy.md) (app runtime),
> [`secrets.md`](./secrets.md), [`env-reference.md`](./env-reference.md),
> and the durable migration rule in this repo's engineering memory
> (every PostGIS/pgvector migration is hand-curated; apply with
> `prisma migrate deploy`, never `migrate dev`).
>
> **Status: PREPARED, NOT EXECUTED.** This is the one deploy step that
> must be run **with the operator present**, against credentials the
> operator supplies. Nothing here has been run against any remote
> database. Treat the target as production unless proven otherwise.

## Why Supabase needs its own runbook

The app is Fly.io (api + web). The **Postgres host is Supabase**, and
Supabase has three sharp edges the generic Fly runbook does not cover:

1. **Two connection strings.** Supabase exposes a **pooled** endpoint
   (PgBouncer, port `6543`, transaction mode) and a **direct** endpoint
   (port `5432`). Prisma **migrations cannot run through PgBouncer**
   (prepared-statement + advisory-lock incompatibility). The app
   runtime should use the pooler; migrations must use the direct URL.
2. **Extensions must be enabled first.** `schema.prisma` declares
   `extensions = [postgis, vector, pg_trgm, pgcrypto]`. Supabase ships
   all four but they are **not enabled by default** in a fresh project.
3. **Curated migrations.** 14 GiST + 2 ivfflat (`PlaceEmbedding`,
   `TripPublication`) indexes + the `Unsupported()` columns are
   hand-maintained. `prisma migrate dev` would emit destructive DROPs —
   it must **never** be run against Supabase. Only `migrate deploy`.

## Schema change required at deploy time (NOT committed — by design)

`apps/api/prisma/schema.prisma` currently has only `url`. For a
Supabase deploy the datasource needs a direct URL for migrations:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")   // app runtime → POOLER (6543)
  directUrl  = env("DIRECT_URL")     // migrations  → DIRECT (5432)
  extensions = [postgis, vector, pg_trgm, pgcrypto]
}
```

This is intentionally **left out of the committed schema** because
adding `directUrl` makes `DIRECT_URL` mandatory for every Prisma
invocation — which would break the local Docker dev loop (single
connection string, no pooler). It is applied as a deliberate,
operator-present deploy step and reverted/kept per the deploy
branch strategy. (`packages/config/src/schema.ts` would likewise gain
`DIRECT_URL: z.string().url()` for the deploy environment only.)

## Preflight (operator, in the Supabase SQL editor)

```sql
-- Postgres 16 + the four extensions the schema needs.
select version();
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
select extname, extversion from pg_extension
  where extname in ('postgis','vector','pg_trgm','pgcrypto');
```

All four must report a version before migrating.

## Deploy procedure (operator-present, one time per environment)

```sh
# 1. Credentials — operator supplies; never commit these.
#    DIRECT_URL  = postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
#    DATABASE_URL= postgresql://postgres.<ref>:<pw>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
export DIRECT_URL='...'        # migrations
export DATABASE_URL="$DIRECT_URL"   # migrate deploy reads DATABASE_URL when no directUrl in schema;
                                     # OR add directUrl (above) and export both.

# 2. Apply the curated migrations — NEVER `migrate dev`.
pnpm --filter=api exec prisma migrate deploy

# 3. Prove the geo/vector layer survived (the durable hazard check).
#    Expect: gist = 14, ivfflat = 2 (PlaceEmbedding + TripPublication).
psql "$DIRECT_URL" -tAc \
  "select 'gist='||count(*) from pg_indexes where indexdef ilike '%USING gist%';"
psql "$DIRECT_URL" -tAc \
  "select 'ivfflat='||count(*) from pg_indexes where indexdef ilike '%USING ivfflat%';"

# 4. Spot-check the 2.0 surface exists.
psql "$DIRECT_URL" -tAc \
  "select to_regclass('public.\"TripPublication\"'), to_regclass('public.\"AgentRun\"'),
          to_regclass('public.\"TripWatch\"'), to_regclass('public.\"Follow\"');"
psql "$DIRECT_URL" -tAc \
  "select column_name from information_schema.columns
   where table_name='TripPublication' and column_name='embedding';"
```

Then deploy the app runtime per [`fly-deploy.md`](./fly-deploy.md)
with `DATABASE_URL` = the **pooler** string (and `DIRECT_URL` set if
`directUrl` was added to the schema).

## Verification gate (all must hold before declaring deployed)

- [ ] Extensions: postgis · vector · pg_trgm · pgcrypto all present
- [ ] `prisma migrate deploy` applied **all 28** migrations, 0 pending
- [ ] `gist = 14`, `ivfflat = 2` (no curated index dropped)
- [ ] `TripPublication.embedding` column exists; 2.0 tables present
- [ ] api boots against the pooler URL; `/health/ready` = 200
- [ ] One smoke trip: create → itinerary → (agent flag on) watch row
      appears → publish an ended trip → it shows in `/feed`

## Rollback / safety

- Supabase keeps **PITR / daily backups** — take a manual backup
  (Dashboard → Database → Backups) immediately BEFORE step 2.
- The migrations are **additive** (no destructive DROPs in any
  curated `.sql`); a failed `migrate deploy` is recoverable by
  restoring the pre-deploy backup. Never hand-edit `_prisma_migrations`.
- **RLS posture:** the app enforces all authz in the application/
  domain layer (owner-scoped repos, block/visibility invariants).
  Supabase RLS is **not** relied upon and is **not** a substitute —
  do not expose the Supabase anon key to clients; the app is the
  only DB consumer (service-role connection, server-side only).

## ⛔ STOP — this step is gated on the operator

Running `prisma migrate deploy` against Supabase is **hard to
reverse and outward-facing**. Required to proceed, from the operator:

1. Confirmation that this Supabase project is the intended target
   (and whether it is production).
2. The `DIRECT_URL` + `DATABASE_URL` (pooler) connection strings, or
   confirmation they are already in the deploy secret store (Doppler
   / Fly secrets per [`secrets.md`](./secrets.md)).
3. Explicit "go" — and the operator present while it runs.

Until all three are given, the deploy stays prepared and unexecuted.
