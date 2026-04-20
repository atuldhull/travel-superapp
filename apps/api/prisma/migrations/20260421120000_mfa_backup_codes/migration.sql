-- Single-use MFA recovery codes. Issued at enrolment + on
-- /mfa/backup-codes/regenerate. `codeHash` = sha256(pepper + plaintext);
-- the plaintext is returned once and never stored.
--
-- Installed by prompt [III.13.2] part 5.

CREATE TABLE "MfaBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaBackupCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaBackupCode_userId_codeHash_key" ON "MfaBackupCode"("userId", "codeHash");
CREATE INDEX "MfaBackupCode_userId_usedAt_idx" ON "MfaBackupCode"("userId", "usedAt");

ALTER TABLE "MfaBackupCode" ADD CONSTRAINT "MfaBackupCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
