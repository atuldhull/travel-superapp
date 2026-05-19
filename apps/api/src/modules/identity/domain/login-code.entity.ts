/**
 * Domain entity for a passwordless one-time sign-in code.
 *
 * The 6-digit code is delivered once (email or SMS) and never stored
 * in plaintext — only `codeHash` (sha256 over EMAIL_PEPPER + code)
 * lives in the DB, exactly like MagicLinkToken. Single-use via
 * `consumedAt`; brute force is bounded by `attempts`.
 *
 * Installed for Phase 1 — Onboarding & Identity (B1/B2: phone +
 * passwordless OTP sign-in).
 */
export type LoginChannel = 'email' | 'phone';

export interface LoginCode {
  readonly id: string;
  readonly channel: LoginChannel;
  /** sha256(EMAIL_PEPPER + normalized destination). */
  readonly destHash: string;
  /** sha256(EMAIL_PEPPER + 6-digit code). */
  readonly codeHash: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}
