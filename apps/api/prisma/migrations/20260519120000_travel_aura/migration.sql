-- Travel Aura identity (Phase 1 — Onboarding & Identity, P1.3).
--
-- CURATED, additive-only. `prisma migrate dev` would re-emit the
-- spurious PostGIS `DROP INDEX "*_gist"` + pgvector ivfflat DROP +
-- `ALTER ... DROP DEFAULT` Unsupported()-type drift (dropping them
-- would destroy the geo + vector layer). Per CLAUDE.md #8 only the
-- new Preferences columns are kept; applied via `prisma migrate
-- deploy`. See feedback prisma-migrate-drops-postgis.

-- AlterTable: new-user traveller identity, home location + interests.
ALTER TABLE "Preferences"
  ADD COLUMN "travelAura" TEXT,
  ADD COLUMN "homeLabel" TEXT,
  ADD COLUMN "homeLat" DOUBLE PRECISION,
  ADD COLUMN "homeLng" DOUBLE PRECISION,
  ADD COLUMN "travelInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
