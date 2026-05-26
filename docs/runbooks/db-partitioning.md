# Runbook — DB partitioning / sharding

> **Installed by [R5]** of the road-to-10-partials closeout. Companion to [`database-pooling.md`](database-pooling.md) (Q1 connection pooling) + [`pgvector-index-tuning.md`](pgvector-index-tuning.md) (Q5 vector index strategy).
>
> Partitioning is the move you make when a single Postgres table becomes the bottleneck no amount of indexes can fix. This runbook documents WHEN to partition, WHICH tables in this codebase are candidates, and the zero-downtime conversion procedure for each. Not yet executed in prod — this is the plan to execute when triggers fire.

## When to consider partitioning

Postgres handles single tables fine up to ~100 GB / ~500M rows with decent indexes. Past that, common pains:

- **`VACUUM` time** balloons. Long autovacuums lock indexes + delay autoanalyze; query plans go stale.
- **Index size** outgrows `shared_buffers`. Index reads start hitting disk, multiplying latency.
- **Delete cost** dominates churn — soft-delete + later mass-purge becomes prohibitively expensive on one giant heap.
- **Backup / restore time** scales O(N) — a multi-hour restore is a multi-hour outage.

Partitioning splits one logical table into many physical sub-tables (Postgres native declarative partitioning). Each partition has its own indexes, its own VACUUM cycle, and can be dropped wholesale (instant). The router (the parent table) routes inserts to the right partition by a partition key.

**Sharding** is the bigger move — different rows on different DATABASES. Out of scope until we exhaust partitioning on a single primary. Documented at the end for the long horizon.

## Candidate tables in this codebase

Three tables match the "append-heavy + queries are time-windowed + churn rate is high" shape that partitioning is meant for.

### 1. `LiveEvent` (highest priority candidate)

**Shape** ([schema.prisma](../../apps/api/prisma/schema.prisma)):

```prisma
model LiveEvent {
  id         String  @id @default(cuid())
  userId     String
  tripId     String?
  geofenceId String?
  kind       LiveEventKind
  payload    Json?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
  @@index([tripId, createdAt])
}
```

**Why a candidate:**

- Writes are append-only (no UPDATE).
- Queries are time-windowed (`createdAt > now() - interval '24 hours'`).
- Volume grows linearly with active users — at 50k DAU × ~20 events/day = 1M rows/day = 365M rows/year. The 100GB / 500M ceiling lands ~6-18 months out depending on the JSON payload size.

**Trigger to partition:**

- Table size > 50 GB, OR
- p95 of `userId + createdAt DESC LIMIT 100` exceeds 100 ms, OR
- Autovacuum on the table runs > 30 min.

**Partitioning strategy: RANGE on `createdAt`, weekly partitions.**

Weekly is the right granularity:

- Daily = too many partitions (52 × 7 = 365/yr; Postgres performance degrades past ~1000 partitions per table).
- Monthly = too coarse; a single partition holds too much.
- Weekly = ~52/yr; matches the "show me LiveEvents from last week" common query.

```sql
-- Step 1: rename the existing table, create the partitioned parent,
-- copy data in batches.
BEGIN;
ALTER TABLE "LiveEvent" RENAME TO "LiveEvent_legacy";

CREATE TABLE "LiveEvent" (
  id         TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "tripId"   TEXT,
  "geofenceId" TEXT,
  kind       "LiveEventKind" NOT NULL,
  payload    JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, "createdAt")  -- partition key must be in PK
) PARTITION BY RANGE ("createdAt");
COMMIT;

-- Step 2: create partitions for the next 12 weeks + a default.
DO $$
DECLARE
  start_date DATE := date_trunc('week', now())::date;
  i INT;
BEGIN
  FOR i IN 0..12 LOOP
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF "LiveEvent" FOR VALUES FROM (%L) TO (%L)',
      'LiveEvent_' || to_char(start_date + (i * 7), 'YYYY_WW'),
      start_date + (i * 7),
      start_date + ((i + 1) * 7)
    );
  END LOOP;
END$$;
CREATE TABLE "LiveEvent_default" PARTITION OF "LiveEvent" DEFAULT;

-- Step 3: indexes on the parent → automatically propagate to partitions.
CREATE INDEX ON "LiveEvent" ("userId", "createdAt");
CREATE INDEX ON "LiveEvent" ("tripId", "createdAt");

-- Step 4: copy legacy data in batches (one transaction per ~10M rows).
-- Run AS A SCRIPT, not inside one transaction — the goal is to commit
-- often so locks don't block writers on the new table.
\set batch_size 10000000
DO $$
DECLARE
  total INT := (SELECT count(*) FROM "LiveEvent_legacy");
  copied INT := 0;
BEGIN
  LOOP
    INSERT INTO "LiveEvent"
    SELECT * FROM "LiveEvent_legacy"
    ORDER BY "createdAt"
    LIMIT 10000000 OFFSET copied;
    EXIT WHEN copied >= total;
    copied := copied + 10000000;
    RAISE NOTICE 'copied % / %', copied, total;
  END LOOP;
END$$;

-- Step 5: cutover — swap reads to the new table, then drop legacy.
-- (Application is already pointing at "LiveEvent"; legacy is just
-- a historical name now.)
DROP TABLE "LiveEvent_legacy";
```

**Ongoing maintenance** — a weekly cron creates the next-12-weeks partitions and drops partitions older than the retention window (per `cost-monitoring.md` 90-day default):

```sql
-- Wrap in pg_cron or a BullMQ scheduled job.
SELECT partman.run_maintenance('public."LiveEvent"');
```

[`pg_partman`](https://github.com/pgpartman/pg_partman) (free Postgres extension; Supabase Pro has it pre-installed) automates this — recommend installing rather than hand-rolling.

### 2. `NotificationLog`

**Shape:**

```prisma
model NotificationLog {
  id                String                     @id @default(cuid())
  userId            String
  channel           NotificationChannel
  status            NotificationDeliveryStatus @default(queued)
  // ... payload, errorMessage, attempts, archivedAt, createdAt, deliveredAt
  @@index([userId, read, createdAt])
  @@index([status, createdAt])
}
```

**Why a candidate:**

- Append-only after final `delivered` / `failed` status (status flips are infrequent post-delivery).
- Queries are time-windowed — the user-inbox lister filters by `createdAt DESC LIMIT 50`.
- Volume grows linearly with notifications sent — easily 1M/day at scale.

**Trigger:** same as LiveEvent — 50 GB table size or 100 ms p95 on the inbox query.

**Strategy:** RANGE on `createdAt`, monthly partitions (less write pressure per partition than LiveEvent — monthly suffices).

Same procedure as LiveEvent above, substituting "monthly" for "weekly". The `status + createdAt` index becomes per-partition automatically.

### 3. `AdminAuditLog`

**Shape** (referenced from data-model.md; not pasted in full):

- Append-only by definition (audit).
- Queries are almost always windowed (recent admin actions).
- Compliance retention often demands 7+ years — partition pruning makes mass-purge instant.

**Trigger:** same as above, plus **the regulatory retention window** — if compliance mandates "drop audit older than 7 years" mass deletes against a non-partitioned table are murder; against a partitioned one they're `DROP TABLE LiveEvent_2019_01`.

**Strategy:** RANGE on `createdAt`, **yearly** partitions (low write rate; 7+ year retention is the dominant constraint).

## Not partitioning (yet)

The other "big" tables don't fit the shape:

- **`User`** — small write rate, dominated by reads. Indexes scale; partitioning would complicate every join.
- **`Place`** — same: catalog table, slow growth, every join needs Place. Partitioning would slow joins, not speed them.
- **`Trip`** — could partition by `createdAt` someday, but trips are queried by `userId` MUCH more often than by date; index alone is sufficient.
- **`PlaceEmbedding`** — already sharded by Place; the `vector(1024)` index (ivfflat/HNSW) is the bottleneck, not the table. See [pgvector-index-tuning.md](pgvector-index-tuning.md).
- **Anything with active UPDATEs** — partitioning interacts badly with updates that cross partition boundaries (the row has to be deleted from one and re-inserted into another). All our partition candidates are append-only.

## Sharding (the long horizon)

When even a partitioned primary saturates, the next move is **horizontal sharding** — different rows on different physical databases. Two viable shapes:

| Shape              | Sharding key                | Trade-offs                                                                  |
| ------------------ | --------------------------- | --------------------------------------------------------------------------- |
| **Tenant-sharded** | `userId` (hash → shard idx) | Clean: one user lives on one shard. Cross-user joins (Social) need fan-out. |
| **Geo-sharded**    | `region` (US / EU / APAC)   | Latency-near for local users. Cross-region operations require coordination. |

Neither is needed until [Q11]'s 10k tier is comfortably exceeded. Pre-work now:

- **No cross-user write transactions today** — every write that touches > 1 user goes through the outbox + Redis Streams (already the pattern, per [Q3]'s `@app/jobs`).
- **No application-level joins across user IDs** — every read either targets one user OR uses pre-aggregated read models.

If we honor these two rules during the partition-only phase, the sharding migration becomes manageable.

## Cost of NOT partitioning

For context — if we kick the can past the trigger:

| Metric                      | Pre-partition (1 table @ 50 GB)                | Post-partition (52 weekly @ ~1 GB)    |
| --------------------------- | ---------------------------------------------- | ------------------------------------- |
| Last-week query latency p95 | ~200-500 ms                                    | ~30-80 ms (partition pruning)         |
| Autovacuum time             | hours (multi-day backlog risk)                 | minutes per partition                 |
| Index size in RAM           | won't fit; disk I/O dominates                  | each partition's index fits           |
| Drop-old-data cost          | `DELETE WHERE createdAt < X` — hours, blocking | `DROP TABLE partition_NNNN` — seconds |

So the trigger thresholds above aren't aesthetic — they're the threshold past which queries START costing real money + real on-call hours.

## Operator-owed

1. **Monitor table size + p95 quarterly** against the trigger thresholds in [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md).
2. **Install `pg_partman`** in Supabase before executing the first partition migration (`CREATE EXTENSION pg_partman;` — pre-installed on Supabase Pro+).
3. **Schedule a maintenance window** for each partition cutover — the data copy is fast but lock contention with writers needs care.
4. **Quarterly partition pruning** — drop partitions older than the retention window per [cost-monitoring.md](cost-monitoring.md).

## See also

- [`database-pooling.md`](database-pooling.md) — Q1 connection pooling; partition-aware pooling still respects the budget
- [`multi-region-failover.md`](multi-region-failover.md) — Q9; partitions live on the same primary, so multi-region replication includes them
- [`pgvector-index-tuning.md`](pgvector-index-tuning.md) — Q5; the index strategy for the one big table we DON'T partition
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — Q7; where the trigger thresholds live
- [pg_partman](https://github.com/pgpartman/pg_partman) — automation extension
- [Postgres docs — table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Supabase — partitioning](https://supabase.com/docs/guides/database/extensions/pg_partman)
