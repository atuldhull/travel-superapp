-- Passwordless OTP sign-in (Phase 1 — Onboarding & Identity, B1/B2).
--
-- CURATED, additive-only. `prisma migrate dev` would re-emit the
-- spurious PostGIS `DROP INDEX "*_gist"` + pgvector ivfflat DROP +
-- Unsupported()-type `ALTER ... DROP DEFAULT` drift (dropping them
-- would destroy the geo + vector layer). Per CLAUDE.md #8 only the
-- new objects are kept; applied via `prisma migrate deploy`. See
-- feedback prisma-migrate-drops-postgis.

-- AlterTable: phone sign-in identity columns on User.
ALTER TABLE "User" ADD COLUMN "phoneHash" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneEncrypted" BYTEA;
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");

-- CreateTable: one-time sign-in codes (email + phone).
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginCode_destHash_createdAt_idx" ON "LoginCode"("destHash", "createdAt");
