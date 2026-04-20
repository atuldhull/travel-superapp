-- Adds sha256(pepper + userAgent) device fingerprint to Session so
-- `RefreshSessionUseCase` can verify presented refreshes come from
-- the same device that issued the session.
--
-- Nullable because rows created before [III.13.2] part 3 don't have
-- a fingerprint; new rows always populate it.
--
-- Installed by prompt [III.13.2] part 3.

ALTER TABLE "Session" ADD COLUMN "deviceFingerprint" TEXT;
