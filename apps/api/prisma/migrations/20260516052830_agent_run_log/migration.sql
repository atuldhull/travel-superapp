-- POST.2A.2 — append-only agent run log + TripWatch.
--
-- CURATED, additive-only. `prisma migrate dev` regenerated this file
-- with 15 spurious `DROP INDEX "*_gist"` + `DROP INDEX
-- "PlaceEmbedding_embedding_ivfflat"` + 2 `ALTER ... DROP DEFAULT`
-- statements. Those PostGIS GiST and pgvector ivfflat indexes are
-- created via raw SQL in earlier migrations and are invisible to
-- Prisma's `Unsupported()` types, so Prisma re-proposes dropping
-- them on every migration. Dropping them would destroy the geo +
-- vector query layer. Per the project convention (every migration
-- that touches geo/vector models is hand-curated) and CLAUDE.md #8
-- (append-only schema), this migration keeps ONLY the new agent
-- objects. Applied with `prisma migrate deploy` (verbatim, no drift
-- re-evaluation).

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('watching', 'closed');

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'watching',
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripWatch" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "subscribedSignals" TEXT[],
    "thresholds" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_tripId_idx" ON "AgentRun"("tripId");

-- CreateIndex
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentStep_agentRunId_createdAt_idx" ON "AgentStep"("agentRunId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentStep_kind_createdAt_idx" ON "AgentStep"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "TripWatch_tripId_active_idx" ON "TripWatch"("tripId", "active");

-- CreateIndex
CREATE INDEX "TripWatch_agentRunId_idx" ON "TripWatch"("agentRunId");
