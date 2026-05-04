-- V.UX.34 — distinct ban state + appeal queue.
--
-- 1. User.bannedAt + banReason — separate from `deletedAt`. The user-
--    self-delete + reactivation flow (V.UX.33) only touches
--    `deletedAt`; admin ban touches only `bannedAt + banReason`. A
--    banned user reactivating via the V.UX.33 link still cannot log
--    in because login also gates on `bannedAt IS NULL`.
--
-- 2. BanAppeal — append-only queue of appeal submissions. Admin
--    triages by `status` ('pending' | 'approved' | 'rejected'). The
--    submit endpoint is unauthed (banned users can't bearer-auth);
--    soft rate-limited per email per hour to deter spam.

ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
CREATE INDEX "User_bannedAt_idx" ON "User"("bannedAt");

CREATE TABLE "BanAppeal" (
  "id"        TEXT          NOT NULL,
  "userId"    TEXT          NOT NULL,
  "emailHash" TEXT          NOT NULL,
  "body"      TEXT          NOT NULL,
  "status"    TEXT          NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "BanAppeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BanAppeal_status_createdAt_idx" ON "BanAppeal"("status", "createdAt");
CREATE INDEX "BanAppeal_userId_createdAt_idx" ON "BanAppeal"("userId", "createdAt");
CREATE INDEX "BanAppeal_emailHash_createdAt_idx" ON "BanAppeal"("emailHash", "createdAt");
ALTER TABLE "BanAppeal"
  ADD CONSTRAINT "BanAppeal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
