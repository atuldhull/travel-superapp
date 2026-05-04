/**
 * V.UX.31 — domain entity for the password-reset token. Sibling to
 * `MagicLinkToken`: same single-use semantics, same hashing posture
 * (plaintext sent in the email link, only `sha256(EMAIL_PEPPER +
 * token)` stored).
 *
 * Installed by prompt [V.UX.31].
 */
export interface PasswordResetToken {
  readonly id: string;
  /** sha256(EMAIL_PEPPER + lower(email)). */
  readonly emailHash: string;
  /** sha256(EMAIL_PEPPER + plaintext token). */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}
