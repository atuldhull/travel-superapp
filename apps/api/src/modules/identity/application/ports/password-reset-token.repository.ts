/**
 * V.UX.31 — port for password-reset token persistence. Mirrors
 * `MagicLinkTokenRepository` exactly.
 *
 * Installed by prompt [V.UX.31].
 */
import type { PasswordResetToken } from '../../domain/password-reset-token.entity';

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');

export interface PasswordResetTokenRepository {
  create(input: {
    readonly emailHash: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<PasswordResetToken>;

  /** Atomic single-use claim. Wins iff: row exists, not consumed, not
   *  expired. Returns the consumed row (carrying emailHash) or null. */
  consume(tokenHash: string, now: Date): Promise<PasswordResetToken | null>;

  /** Soft rate-limit support — count tokens minted for this email
   *  in the last `withinMs` milliseconds. */
  countRecentForEmail(emailHash: string, withinMs: number): Promise<number>;
}
