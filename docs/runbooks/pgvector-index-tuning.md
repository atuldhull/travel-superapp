# Runbook — pgvector index tuning (IVFFlat → HNSW switch)

> **Installed by [Q5]** of the Scale-readiness 3→10 series. Companion to [database-pooling.md](database-pooling.md) + [`apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`](../../apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql) + ADR-007.

`PlaceEmbedding.embedding vector(1024)` is the hottest similarity-search surface in the codebase — `VectorQueries.findSimilar()` runs on every Places federated lookup. Today it's IVFFlat with `lists = 100`. This runbook codifies WHEN to retune, HOW (with the math), and the zero-downtime swap to HNSW when IVFFlat stops scaling.

## Background — the three knobs

| Index type          | Build time | Query time       | Recall                | Best when                                     |
| ------------------- | ---------- | ---------------- | --------------------- | --------------------------------------------- |
| **IVFFlat**         | minutes    | O(√N) typical    | tuneable via `probes` | < 1M rows, infrequent rebuilds, simple ops    |
| **HNSW**            | hours      | O(log N) typical | better at high recall | > 1M rows, write-heavy, need < 50ms p95 reads |
| **Flat (no index)** | none       | O(N) — exact     | 100%                  | < 10k rows, exact match required              |

We are on IVFFlat today (the default for the project's scale). The switch to HNSW is operationally one CREATE INDEX CONCURRENTLY + an atomic ALTER away.

## The IVFFlat math (re-tune before swapping)

IVFFlat is "inverted file" — it partitions rows into `lists` clusters once, then probes the nearest `probes` clusters at query time. Two knobs:

| Knob     | Default today  | Tune by                                   | Rule of thumb                                                   |
| -------- | -------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `lists`  | `100`          | Number of clusters at index-build time.   | `lists = sqrt(rows)` for ≤ 1M; `lists = rows / 1000` for > 1M.  |
| `probes` | `10` (session) | Number of clusters scanned at query time. | `probes = sqrt(lists)`. Bump for higher recall; cost is linear. |

`probes` is a SESSION variable — set per query via `SET LOCAL ivfflat.probes = N`. The CONFIG default lives in Postgres (`postgresql.conf` or per-database `ALTER DATABASE … SET`).

### Re-tuning IVFFlat (before considering HNSW)

```sql
-- Step 1: measure current scale.
SELECT count(*) FROM "PlaceEmbedding";
-- Suppose 250000.

-- Step 2: compute target.
-- lists = sqrt(250000) = 500.
-- probes = sqrt(500)  = ~22.

-- Step 3: rebuild concurrently to avoid table lock.
CREATE INDEX CONCURRENTLY "PlaceEmbedding_embedding_ivfflat_v2"
  ON "PlaceEmbedding"
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 500);

-- Step 4: atomic swap (one-statement transaction).
BEGIN;
DROP INDEX "PlaceEmbedding_embedding_ivfflat";
ALTER INDEX "PlaceEmbedding_embedding_ivfflat_v2"
  RENAME TO "PlaceEmbedding_embedding_ivfflat";
COMMIT;

-- Step 5: bump session probes default for the api role.
ALTER ROLE travel SET ivfflat.probes = 22;
```

The swap is online — readers using the old index keep going during the CREATE INDEX CONCURRENTLY; the rename happens inside a transaction so there's no window where neither index exists.

## When to switch to HNSW

Per ADR-007 + the migration comment, switch when ANY of:

1. **Row count > 1,000,000**. IVFFlat's `probes` cost grows linearly; HNSW's log-time becomes a real advantage.
2. **Recall@10 < 0.95** on a measured eval set with the recommended `probes`. Indicates the embedding space is harder than IVFFlat's clustering can handle.
3. **Rebuild > 1 hour**. IVFFlat's full rebuild scales as O(N log N); HNSW's incremental insert means no full rebuild ever needed.
4. **p95 read latency > 100ms** for the `<->` query with reasonable Postgres CPU headroom. HNSW is faster at scale.

If none apply, **re-tune IVFFlat first** — the simpler index is more honest.

## How to measure recall

```sql
-- Build a ground-truth set: 1000 random queries × their exact top-10
-- using a Flat (no-index) seq scan.
CREATE TEMP TABLE recall_eval AS
SELECT
  e1.id        AS query_id,
  e1.embedding AS query_vec,
  array_agg(e2.id ORDER BY e1.embedding <-> e2.embedding LIMIT 10) AS exact_top10
FROM "PlaceEmbedding" e1
TABLESAMPLE BERNOULLI(0.5)  -- ~0.5% random sample
CROSS JOIN LATERAL (
  SELECT id FROM "PlaceEmbedding"
  ORDER BY e1.embedding <-> embedding
  LIMIT 10
) e2
GROUP BY e1.id, e1.embedding;

-- Now ask the IVFFlat index for the same top-10 with current probes.
SET LOCAL ivfflat.probes = 10;
SELECT
  AVG(cardinality(exact_top10 & approx_top10) / 10.0) AS recall_at_10
FROM recall_eval, LATERAL (
  SELECT array_agg(id) AS approx_top10
  FROM (
    SELECT id FROM "PlaceEmbedding"
    ORDER BY query_vec <-> embedding
    LIMIT 10
  ) t
) approx;
```

Target: `recall_at_10 ≥ 0.95`. Below that, bump `probes` (cheaper); below that AT max probes, switch index type (HNSW).

## HNSW switch — zero-downtime procedure

```sql
-- Step 1: build the HNSW index concurrently. THIS TAKES HOURS at
-- the size we'd switch at. Run during a low-traffic window;
-- set a STATEMENT_TIMEOUT = 0 for the session.
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY "PlaceEmbedding_embedding_hnsw"
  ON "PlaceEmbedding"
  USING hnsw (embedding vector_l2_ops)
  WITH (
    m = 16,              -- bidirectional links per layer (default 16)
    ef_construction = 64 -- build-time exploration (default 64; bump
                         -- to 128 if recall < 0.97 at query time)
  );

-- Step 2: A/B test. Force the planner to pick HNSW on a fraction
-- of traffic for a day. Easiest path: a feature flag that wraps the
-- `<->` query with `/*+ IndexScan(PlaceEmbedding PlaceEmbedding_embedding_hnsw) */`
-- via pg_hint_plan. Compare:
--   - p50/p95/p99 latency
--   - recall@10 on a shadow eval set
--   - Postgres CPU / IO

-- Step 3: query-time tuning lives in `ef_search` (SESSION var).
SET LOCAL hnsw.ef_search = 40;  -- default; bump for higher recall.

-- Step 4: atomic swap once A/B confirms HNSW wins.
BEGIN;
DROP INDEX "PlaceEmbedding_embedding_ivfflat";
ALTER INDEX "PlaceEmbedding_embedding_hnsw"
  RENAME TO "PlaceEmbedding_embedding";  -- canonical name
COMMIT;
```

**Don't** drop the IVFFlat index until HNSW has been the live index for at least 24 hours with the production read pattern — rollback is `CREATE INDEX CONCURRENTLY` again, and that's expensive.

## Operator-owed

1. **Run the recall measurement** quarterly. Append the result to `docs/perf-history/pgvector-recall.md` (forthcoming).
2. **Watch the index size** — `SELECT pg_size_pretty(pg_relation_size('"PlaceEmbedding_embedding_ivfflat"'));`. IVFFlat is ~10MB per 1M rows × 1024 dims; HNSW is ~40MB per 1M rows × 1024 dims at default `m`.
3. **Schedule the HNSW switch in a maintenance window** — `CREATE INDEX CONCURRENTLY` for HNSW at 5M rows is a multi-hour operation that pegs one CPU and writes a lot of WAL. Coordinate with the on-call.

## See also

- [`apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`](../../apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql) — current index definition
- [`docs/adr/ADR-007-data-layer.md`](../adr/ADR-007-data-layer.md) — the architectural decision (data-layer ADR; pgvector index strategy is one section)
- [`docs/runbooks/database-pooling.md`](database-pooling.md) — Postgres connection budget
- [pgvector — IVFFlat vs HNSW](https://github.com/pgvector/pgvector#indexing)
- [Supabase pgvector tuning guide](https://supabase.com/docs/guides/database/extensions/pgvector#performance)
