-- Adventure Diary + gamification (user-directed feature).
--
-- CURATED, additive-only. `prisma migrate dev` would re-emit the
-- spurious PostGIS `DROP INDEX "*_gist"` + pgvector ivfflat DROP +
-- `ALTER ... DROP DEFAULT` Unsupported()-type drift (dropping them
-- would destroy the geo + vector layer). Per project convention +
-- the append-only schema rule only the new diary objects are kept; applied via
-- `prisma migrate deploy`. See feedback prisma-migrate-drops-postgis.

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mood" TEXT,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationProfile" (
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "aiAssistCount" INTEGER NOT NULL DEFAULT 0,
    "lastEntryOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "EarnedBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnedBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_createdAt_idx" ON "DiaryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_entryDate_idx" ON "DiaryEntry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "DiaryEntry_tripId_idx" ON "DiaryEntry"("tripId");

-- CreateIndex
CREATE INDEX "EarnedBadge_userId_idx" ON "EarnedBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EarnedBadge_userId_badgeKey_key" ON "EarnedBadge"("userId", "badgeKey");
