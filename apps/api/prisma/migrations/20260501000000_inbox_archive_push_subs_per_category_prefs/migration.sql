-- V.UX.26 — inbox archive + Web Push subscriptions + per-category prefs.
--
-- 1. NotificationLog grows `archivedAt: timestamp?` so users can
--    swipe-to-archive without a hard delete. Lister filters out
--    `archivedAt IS NOT NULL`.
-- 2. NotificationPreference grows `categoriesDisabled: text[]` for
--    per-category opt-out + `lastDigestSentAt: timestamp?` so the
--    weekly-digest scheduler can enforce a "Sunday 8am LOCAL, once
--    per week" cadence without an external cron table.
-- 3. PushSubscription is new — one row per browser install. endpoint
--    is globally unique (browser-vendor URL); p256dh + auth are the
--    Web Push spec §3 encryption keys. Hard-deleted on 410 Gone or
--    user-initiated unsubscribe.

ALTER TABLE "NotificationLog"
  ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "NotificationLog_userId_archivedAt_createdAt_idx"
  ON "NotificationLog"("userId", "archivedAt", "createdAt");

ALTER TABLE "NotificationPreference"
  ADD COLUMN "categoriesDisabled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NotificationPreference"
  ADD COLUMN "lastDigestSentAt" TIMESTAMP(3);

CREATE TABLE "PushSubscription" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "endpoint"  TEXT NOT NULL,
  "p256dh"    TEXT NOT NULL,
  "auth"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
