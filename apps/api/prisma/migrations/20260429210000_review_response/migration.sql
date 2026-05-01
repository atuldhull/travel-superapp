-- V.UX.24 — agent persona: target-owner reply on a review. Both
-- columns nullable so existing rows back-fill cleanly. The use-case
-- enforces "at most one response per review".
ALTER TABLE "Review" ADD COLUMN "responseBody" TEXT;
ALTER TABLE "Review" ADD COLUMN "responseAt" TIMESTAMP(3);
