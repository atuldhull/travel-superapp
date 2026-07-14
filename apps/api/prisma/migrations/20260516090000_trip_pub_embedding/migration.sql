-- POST.2C.2 — trip publication pgvector embedding (discovery + agent grounding).
--
-- CURATED, additive-only. `prisma migrate dev` would re-emit the 15
-- spurious PostGIS `DROP INDEX "*_gist"`, the pgvector
-- `PlaceEmbedding_embedding_ivfflat` DROP, and 2 `ALTER ... DROP
-- DEFAULT` (Unsupported()-type drift — applying them would destroy
-- the geo + vector layer). Per project convention + the append-only schema rule only
-- the new, additive objects are kept here; applied via `prisma
-- migrate deploy`. See feedback prisma-migrate-drops-postgis-indexes.
--
-- Strictly additive: ONE nullable column + ONE ivfflat index. No
-- backfill, no NOT NULL, no DROP, no destructive ALTER. The `vector`
-- extension has existed since 1.0 (migration 20260420081604) so no
-- CREATE EXTENSION is needed. Dimension 1024 + `vector_l2_ops`
-- ivfflat `lists = 100` copy the `PlaceEmbedding` precedent exactly
-- (migration 20260420081604_vector_ivfflat) for index/op-class
-- consistency with `VectorQueries`.

-- AddColumn (nullable; absent Ollama → stays NULL, publication still works)
ALTER TABLE "TripPublication" ADD COLUMN "embedding" vector(1024);

-- CreateIndex (IVFFlat L2; mirrors PlaceEmbedding_embedding_ivfflat)
CREATE INDEX IF NOT EXISTS "TripPublication_embedding_ivfflat"
ON "TripPublication"
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);
