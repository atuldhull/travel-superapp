-- POST.2B.2 — trip publication + privacy-fenced publish.
--
-- CURATED, additive-only. `prisma migrate dev` re-emitted the 15
-- spurious PostGIS `DROP INDEX "*_gist"` + pgvector ivfflat DROP + 2
-- `ALTER ... DROP DEFAULT` (Unsupported()-type drift — dropping them
-- would destroy the geo + vector layer). Per project convention +
-- the append-only schema rule, only the new publication objects are kept. Applied
-- via `prisma migrate deploy`. See feedback prisma-migrate-drops-postgis.

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'FOLLOWERS', 'PUBLIC');

-- CreateTable
CREATE TABLE "TripPublication" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "memoryBookId" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "exposedLat" DOUBLE PRECISION,
    "exposedLng" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripPublication_tripId_key" ON "TripPublication"("tripId");

-- CreateIndex
CREATE INDEX "TripPublication_authorId_idx" ON "TripPublication"("authorId");

-- CreateIndex
CREATE INDEX "TripPublication_visibility_publishedAt_idx" ON "TripPublication"("visibility", "publishedAt");
