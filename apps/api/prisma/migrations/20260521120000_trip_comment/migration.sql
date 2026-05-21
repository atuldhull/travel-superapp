-- Phase 5 (J4) — comments on published trips.
--
-- Adds the `TripComment` table: flat (no threading) comments keyed by
-- tripId + authorId. Apply via `prisma migrate deploy` (NOT
-- `migrate dev` — that auto-drops the PostGIS + ivfflat indexes the
-- schema can't reify; see the durable memory note
-- `prisma-migrate-drops-postgis-indexes`).
--
-- Pure CREATE TABLE + two btree indexes. FK-less (the Follow /
-- UserBlock / TripPublication precedent). No PostGIS/pgvector drift.

CREATE TABLE "TripComment" (
  "id"        TEXT NOT NULL,
  "tripId"    TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripComment_pkey" PRIMARY KEY ("id")
);

-- The per-trip thread, read chronologically.
CREATE INDEX "TripComment_tripId_createdAt_idx" ON "TripComment" ("tripId", "createdAt");

-- "comments by X" + the author-delete gate.
CREATE INDEX "TripComment_authorId_idx" ON "TripComment" ("authorId");
