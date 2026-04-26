/**
 * Domain entity for the passwordless sign-in token.
 *
 * The plaintext `token` is sent to the user once via email and then
 * never persisted — only `tokenHash` lives in the database. Single-
 * use is enforced by setting `consumedAt` at consume time and
 * rejecting any subsequent consume of the same hash.
 *
 * Installed by prompt [V.UX.2].
 */
export interface MagicLinkToken {
  readonly id: string;
  /** sha256(EMAIL_PEPPER + lower(email)) — same hash User.emailHash uses. */
  readonly emailHash: string;
  /** sha256(EMAIL_PEPPER + plaintext token). */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}
