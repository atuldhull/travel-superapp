-- Phase 3 (G1) — Living Current Trip
--
-- Adds a nullable `completedAt` column to ItineraryItem so the user
-- can mark a beat done as they live the trip. Apply via
-- `prisma migrate deploy` (NOT `migrate dev` — that auto-drops the
-- PostGIS + ivfflat indexes that the schema can't reify; see the
-- durable memory note `prisma-migrate-drops-postgis-indexes`).
--
-- Pure ADD COLUMN. Nullable, no default, no backfill, no index — the
-- column is small enough that filtering reads stay cheap, and a
-- partial index can be added later if the access pattern demands it.

ALTER TABLE "ItineraryItem"
  ADD COLUMN "completedAt" TIMESTAMP(3);
