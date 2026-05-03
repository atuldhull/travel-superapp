-- V.UX.30 — soft-archive trips + track last-seen for the welcome-back hero.
--
-- 1. Trip.archivedAt — nullable timestamp. The auto-archive scheduler
--    sets it to now() once a trip is older than 365 days; users can
--    archive/unarchive manually too. The /trips lister filters
--    archivedAt IS NULL by default; the Archived tab passes
--    `archived=true`.
--
-- 2. User.lastSeenAt — nullable timestamp. Stamped on every successful
--    /auth/me hit. The welcome-back hero fires when the gap from the
--    PREVIOUS lastSeenAt to "now" was > 30 days. We can't compute the
--    gap from a single column without bookkeeping, so we ALSO add
--    `previousSeenAt` for the diff. The hero reads previousSeenAt
--    (the last visit BEFORE this one); /auth/me writes the swap.

ALTER TABLE "Trip" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Trip_userId_archivedAt_createdAt_idx"
  ON "Trip"("userId", "archivedAt", "createdAt");

ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "previousSeenAt" TIMESTAMP(3);
