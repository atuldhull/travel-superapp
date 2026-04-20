-- IVFFlat index on `PlaceEmbedding.embedding` for fast L2 nearest-
-- neighbour search via `<->`. `lists = 100` is the pgvector default
-- recommendation for up to ~1M rows.
--
-- Prisma can't express this (embedding is `Unsupported("vector(1024)")`),
-- so it lives as a hand-edited migration. Op-class `vector_l2_ops`
-- matches the `<->` operator used by `VectorQueries.findSimilar`.
-- Switching to cosine (`<=>`) would require `vector_cosine_ops`.
--
-- HNSW switch triggers (per [ADR-007] + VectorQueries doc):
--   • row count > 1,000,000, OR
--   • recall@10 < 0.95 on a measured eval set, OR
--   • IVFFlat rebuild > 1 hour.
--
-- Installed by prompt [III.12.3].

CREATE INDEX IF NOT EXISTS "PlaceEmbedding_embedding_ivfflat"
ON "PlaceEmbedding"
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);
