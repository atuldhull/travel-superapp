/**
 * Port: persistence for passwordless one-time sign-in codes (B1/B2).
 * Mirrors MagicLinkTokenRepository — single-use via an atomic
 * updateMany guard, soft rate-limit via a recent-count.
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import type { LoginChannel, LoginCode } from '../../domain/login-code.entity';

export const LOGIN_CODE_REPOSITORY = Symbol('LOGIN_CODE_REPOSITORY');

export interface LoginCodeRepository {
  create(input: {
    readonly channel: LoginChannel;
    readonly destHash: string;
    readonly codeHash: string;
    readonly expiresAt: Date;
  }): Promise<LoginCode>;

  /** Newest non-consumed, non-expired code for a destination, or null. */
  findActive(destHash: string): Promise<LoginCode | null>;

  /** Bump the wrong-guess counter; returns the new attempt count. */
  registerFailedAttempt(id: string): Promise<number>;

  /** Atomic single-use claim. True iff this caller flipped
   *  `consumedAt: null → now` (row present + unexpired). */
  consume(id: string, now: Date): Promise<boolean>;

  /** Soft rate-limit — codes minted for this destination in the
   *  last `withinMs` milliseconds. */
  countRecent(destHash: string, withinMs: number): Promise<number>;
}
