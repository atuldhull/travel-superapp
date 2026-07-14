-- POST.2B.1 — follow graph + user block.
--
-- CURATED, additive-only. `prisma migrate dev` regenerated this with
-- 15 spurious `DROP INDEX "*_gist"` + `DROP INDEX
-- "PlaceEmbedding_embedding_ivfflat"` + 2 `ALTER ... DROP DEFAULT`
-- (Prisma's Unsupported()-type drift — those PostGIS/pgvector indexes
-- are raw-SQL in earlier migrations and invisible to Prisma; dropping
-- them would destroy the geo + vector layer). Per the project
-- convention + the append-only schema rule, only the new social-graph objects are
-- kept. Applied via `prisma migrate deploy` (verbatim, no drift
-- re-evaluation). See feedback memory prisma-migrate-drops-postgis.

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followeeId")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "Follow_followeeId_idx" ON "Follow"("followeeId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");
