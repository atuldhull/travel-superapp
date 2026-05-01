-- V.UX.25 — reviewer karma + community helpful votes.
--
-- UserKarma is one row per user (unique on userId). The score column
-- is recomputed by RecomputeKarmaUseCase; columns are denormalised
-- for cheap reads on the public profile page.
--
-- HelpfulVote is one row per (reviewId, voterId). Self-vote is
-- enforced at the use-case (no DB constraint).

CREATE TABLE "UserKarma" (
  "id"                   TEXT      NOT NULL,
  "userId"               TEXT      NOT NULL,
  "score"                INTEGER   NOT NULL DEFAULT 0,
  "reviewCount"          INTEGER   NOT NULL DEFAULT 0,
  "helpfulVotesReceived" INTEGER   NOT NULL DEFAULT 0,
  "badges"               TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recomputedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserKarma_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserKarma_userId_key" ON "UserKarma"("userId");
CREATE INDEX "UserKarma_score_idx" ON "UserKarma"("score");
ALTER TABLE "UserKarma"
  ADD CONSTRAINT "UserKarma_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HelpfulVote" (
  "id"        TEXT NOT NULL,
  "reviewId"  TEXT NOT NULL,
  "voterId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HelpfulVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HelpfulVote_reviewId_voterId_key" ON "HelpfulVote"("reviewId", "voterId");
CREATE INDEX "HelpfulVote_voterId_createdAt_idx" ON "HelpfulVote"("voterId", "createdAt");
ALTER TABLE "HelpfulVote"
  ADD CONSTRAINT "HelpfulVote_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpfulVote"
  ADD CONSTRAINT "HelpfulVote_voterId_fkey"
  FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
