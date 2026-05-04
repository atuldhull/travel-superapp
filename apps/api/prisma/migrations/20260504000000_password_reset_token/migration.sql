-- V.UX.31 — password reset tokens (sibling to MagicLinkToken).
--
-- Same shape: emailHash + tokenHash UNIQUE + expiresAt + consumedAt.
-- Single-use atomic consume via `updateMany where consumedAt IS NULL
-- AND expiresAt > now`. The plaintext is never stored — only
-- sha256(EMAIL_PEPPER + token).

CREATE TABLE "PasswordResetToken" (
  "id"         TEXT          NOT NULL,
  "emailHash"  TEXT          NOT NULL,
  "tokenHash"  TEXT          NOT NULL,
  "expiresAt"  TIMESTAMP(3)  NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_emailHash_createdAt_idx"
  ON "PasswordResetToken"("emailHash", "createdAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
