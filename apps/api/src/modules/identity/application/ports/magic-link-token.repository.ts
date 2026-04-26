/**
 * Port: persistence for passwordless sign-in tokens.
 *
 * Installed by prompt [V.UX.2].
 */
import type { MagicLinkToken } from '../../domain/magic-link-token.entity';

export const MAGIC_LINK_TOKEN_REPOSITORY = Symbol('MAGIC_LINK_TOKEN_REPOSITORY');

export interface MagicLinkTokenRepository {
  create(input: {
    readonly emailHash: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<MagicLinkToken>;

  /** Find a non-expired, non-consumed token by its hash. Returns null
   *  if missing, expired, or already consumed. */
  findActiveByHash(tokenHash: string): Promise<MagicLinkToken | null>;

  /** Atomic single-use claim. Returns the row that was flipped from
   *  `consumedAt: null` → now (caller wins the race), or null if the
   *  token is missing / expired / already consumed. The returned row
   *  carries the `emailHash` the caller needs to look up / create
   *  the matching User. */
  consume(tokenHash: string, now: Date): Promise<MagicLinkToken | null>;

  /** Soft rate-limit support — count tokens minted for this email
   *  in the last `withinMs` milliseconds. */
  countRecentForEmail(emailHash: string, withinMs: number): Promise<number>;
}
