# ADR-007 — Data layer: Postgres 16 + PostGIS + pgvector + Redis 7 + Meilisearch

- **Status:** Accepted
- **Date:** 2026-04-19
- **Prompt:** `[II.8.3]`
- **Playbook reference:** §8.3

## Context

TravelSuperApp touches four distinct data shapes on the hot path: **relational** (trips, users, sessions, stays), **geospatial** (places within radius, safety heatmap, route legs), **vector** (place embeddings for semantic search + dedup), and **full-text search** (typo-tolerant place / review lookup). Add **cache + queue + event streams** (Redis 7 — already decided in [ADR-003](./ADR-003-event-backbone.md)) and we're looking at a data layer with four independent storage surfaces in the typical startup.

The naïve approach — a dedicated service per shape (Postgres + PostGIS server + Pinecone + Elasticsearch + Redis) — is five operational surfaces. For a 1–3 engineer team, that's the end of the road for product velocity.

This ADR locks the data-layer choices around **one Postgres with extensions** for relational + geo + vectors, plus Redis for cache/queue/streams, plus Meilisearch for full-text.

## Decision drivers

- **One transactional boundary.** A trip write touches `Trip` + `ItineraryItem` + `PlaceEmbedding` lookup. We want a single `prisma.$transaction` to cover the relational bits; the vector and geo reads can happen immediately after against the same DB.
- **One ops surface at MVP.** One Postgres cluster to back up, patch, failover. Replace with three clusters later if the data volume justifies it.
- **Typed access from the ORM.** Prisma handles the relational layer natively. PostGIS + pgvector live behind `$queryRaw`-wrapped helper services (`GeoQueries`, `VectorQueries`). Non-negotiable: domain code never sees raw SQL (CLAUDE.md rule 11).
- **Queue + stream + cache on the SAME Redis.** We already run Redis for sessions + rate limits ([ADR-006](./ADR-006-backend-stack.md)). Adding Streams + BullMQ on the same cluster is near-free.
- **Full-text search quality.** Meilisearch because `pg_trgm` + `tsvector` handles typos mediocrely; a dedicated search engine gives us typo tolerance + faceting + ranking that Postgres can't match without a lot of glue.
- **Escape hatches that don't leak.** Every choice below has a documented "when to split" trigger. The cost of staying too long is architectural paint-in-corner; the cost of splitting too early is months of ops work against a product that hasn't found fit.

## Considered choices (each locked, each with one rejected alternative)

### 1. Primary datastore — **Postgres 16**

**Chosen.** Battle-tested. Row-level locking + MVCC + partial indexes + expression indexes. Managed in every cloud. Prisma's first-class target. Handles 100k+ writes/sec on commodity hardware; we won't outrun it at MVP.

**Rejected alternative: CockroachDB.** Multi-region strong consistency, Postgres wire-compat, elastic. Real win when you're hitting >1 region and multi-master reads. But ops complexity + licensing + smaller extension ecosystem (no PostGIS at feature parity, no pgvector) make it a non-starter today. Re-evaluate if we're running in >1 region with write-heavy multi-region flows.

### 2. Geospatial — **PostGIS** (inside the same Postgres)

**Chosen.** Installed as a Postgres extension; Prisma declares it in `datasource.db.extensions` (Playbook §12.5). Standard `geography(Point, 4326)` columns + GiST indexes; `ST_DWithin` / `ST_Distance` / `ST_MakeEnvelope` hit the same rows the ORM sees. Our `GeoQueries` service wraps the raw SQL per [CLAUDE rule 11](../../CLAUDE.md).

**Rejected alternative: Elasticsearch geo-search.** Tempting because we're already running a second indexer (Meilisearch) — why not use ES for both? But: an extra cluster to operate, denormalised data constantly drifting out of sync with the source of truth (the DB), and PostGIS's JOIN-with-relational-data story is strictly better. Geo + relational in one SQL query is a real feature.

### 3. Vector / embeddings — **pgvector** (same Postgres, for now)

**Chosen.** Installed as the `vector` extension (extension package name is `vector`, not `pgvector` — Playbook §12.5 footnote). IVFFlat index at MVP (good recall up to ~1M rows); HNSW when we cross the threshold. Lives on the same row as the relational Place record via a 1:1 `PlaceEmbedding` table keyed by `placeId` — JOIN-able with the source of truth.

**Rejected alternative: Pinecone** (or Weaviate, Qdrant, etc.). Dedicated vector database, better recall at 10M+ embeddings, sub-10 ms p95 at scale. But: another cluster, denormalised data, no JOIN-with-Postgres story. The savings only materialise once we're actually hitting the split trigger below. Until then, pgvector stays.

**Split trigger (QUANTITATIVE — acceptance criterion):**

> Migrate vectors out of Postgres to a dedicated vector DB when **either** of the following becomes true, measured over a rolling **14-day** window:
>
> 1. **Row count:** `PlaceEmbedding` (or any single vector table) exceeds **5,000,000 rows**, **OR**
> 2. **Query latency:** `SELECT ... ORDER BY embedding <-> $1 LIMIT k` p95 exceeds **150 ms** for `k ≤ 50`, measured at the `VectorQueries` adapter layer (not end-to-end).

If both are comfortably under — stay on pgvector. If one crosses for two consecutive windows — open a superseding ADR naming the replacement (likely Qdrant for ops parity, or managed Pinecone if we want zero ops). Migration is adapter-swap: `VectorQueries` becomes an HTTP client, the domain never notices.

### 4. Cache · queue · streams · sessions · rate limits — **Redis 7**

**Chosen.** Already the decision in [ADR-003 (Streams)](./ADR-003-event-backbone.md) and [ADR-006 (BullMQ)](./ADR-006-backend-stack.md); this ADR formalises the overall "one Redis for five things" posture. Sessions + rate-limit keys + LRU cache + consumer-group streams (events) + BullMQ queues — all on the same cluster with different key namespaces (`@app/cache` owns the namespacing).

**Rejected alternative: Split caches — Memcached for LRU + Redis for the rest.** Memcached is slightly faster on pure GET/SET and has better LRU eviction semantics. But a second cluster for marginally-better cache hit latency is not a trade we'd make pre-PMF. Redis's `allkeys-lru` policy is fine.

### 5. Full-text search — **Meilisearch**

**Chosen.** Typo-tolerant, faceted, fast. OSS, single-binary, runs in Docker Compose dev. Much simpler ops than Elasticsearch — one process, one config file. Integration is a lightweight indexer in `apps/api` that subscribes to `Places.PlaceIndexed` + `Events.CulturalEventIndexed` (see [context-map](../architecture/context-map.md)) and keeps the search index fresh.

**Rejected alternative: Postgres `pg_trgm` + `tsvector` + `rank_bm25`-style extension.** Would keep us on one database. We considered it seriously. But: typo tolerance via trigrams is coarse, faceting requires denormalised aux tables, ranking quality is materially worse than Meili's out-of-the-box relevance. And Meilisearch's op cost is genuinely low. A dedicated search engine pays for itself on feature shipped → user-visible quality alone.

## Summary

| #   | Surface                            | Chosen                                | Rejected (one)                      |
| --- | ---------------------------------- | ------------------------------------- | ----------------------------------- |
| 1   | Primary datastore                  | Postgres 16                           | CockroachDB                         |
| 2   | Geospatial                         | PostGIS (in same Postgres)            | Elasticsearch geo-search            |
| 3   | Vector / embeddings                | pgvector (in same Postgres — for now) | Pinecone                            |
| 4   | Cache · queue · streams · sessions | Redis 7 (one cluster, namespaced)     | Memcached for cache, Redis for rest |
| 5   | Full-text search                   | Meilisearch                           | Postgres `pg_trgm` + `tsvector`     |

## Consequences (binding)

- **Every DB write goes through Prisma or `GeoQueries` / `VectorQueries`.** Ad-hoc `$queryRaw` outside those services fails review.
- **PostGIS columns are typed `Unsupported("geography(Point, 4326)")`** in `schema.prisma`. Any Prisma `create` / `update` on those fields is a bug — always go through `GeoQueries.insertPlace()` etc. (CLAUDE rule 11). This ADR promotes that rule from CLAUDE-level to ADR-level.
- **Migrations are `prisma migrate deploy`** with shadow-DB drift check in CI (Playbook §18). Raw SQL migrations land via Prisma's `prisma/migrations/<timestamp>/migration.sql` hand-edit escape hatch — only for extension installs (PostGIS, vector, pg_trgm, pgcrypto) and index creations Prisma can't express.
- **Redis keys are namespaced per-env + per-purpose via `@app/cache`.** Queue: `travel-<env>:queue:<name>`. Cache: `travel-<env>:cache:<module>:<key>`. Stream: `travel-<env>:stream:<event>`. Cross-env spill fails in review.
- **Meilisearch indexes are owned by the module that writes them.** Places owns `places` index; Events owns `cultural-events`; Safety owns `scam-reports`. No cross-module writes to the same index.
- **pgvector split trigger is a quantitative tripwire, not a judgement call.** 5M rows OR 150 ms p95 for 14 days — then open the superseding ADR. Anyone crossing the threshold without triggering the ADR is a policy violation.

## Re-evaluation triggers

This ADR is reviewed if any of the following becomes true:

- **pgvector split trigger** above fires.
- We go multi-region write-active. CockroachDB or Postgres logical replication + BDR becomes a real conversation.
- Meilisearch's RAM footprint crosses what a single node can hold (typically >200 GB indexed documents) AND we have a clear path to OpenSearch. Until then, more Meili nodes.
- A new workload emerges that pg_trgm/tsvector/PostGIS/pgvector can't serve — time-series (TimescaleDB), graph (Neo4j or Age), etc. Evaluate on its own merits; don't force-fit into Postgres.
- Any compliance regime mandates encryption-at-rest guarantees we can't meet with our managed Postgres. Unlikely, but track explicitly.

## Links

- Playbook §8.3 (Data Layer) · §12 (Data Modeling) · §13.4 (Rate limit pepper — rides on this Redis).
- Sibling ADRs: [ADR-003 Event backbone](./ADR-003-event-backbone.md), [ADR-006 Backend stack](./ADR-006-backend-stack.md), [ADR-005 Frontend stack](./ADR-005-frontend-stack.md), [ADR-008 AI stack](./ADR-008-ai-stack.md) (pending).
- [docker-compose](../../infra/docker-compose.yml) — the five local services this ADR names (Postgres + Redis + Meilisearch + MinIO + Mailpit) are already running.
- [docs/env.md](../env.md) — the env vars for each datastore.
- [PostGIS](https://postgis.net/) · [pgvector](https://github.com/pgvector/pgvector) · [Meilisearch](https://www.meilisearch.com/) · [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/).
