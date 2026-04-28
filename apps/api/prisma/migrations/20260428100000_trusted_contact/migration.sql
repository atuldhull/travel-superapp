-- V.UX.13 — pre-set safety contacts. Cap of 3 is enforced in the
-- application layer (matches MfaBackupCode's per-user cap pattern).
-- On SOS trigger these are fanned out via the contact-notifier port.

CREATE TABLE "TrustedContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrustedContact_userId_createdAt_idx"
    ON "TrustedContact" ("userId", "createdAt");

ALTER TABLE "TrustedContact"
    ADD CONSTRAINT "TrustedContact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
