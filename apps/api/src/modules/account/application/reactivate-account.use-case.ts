/**
 * V.UX.33 — clear `User.deletedAt` so a soft-deleted account that
 * sat inside the 7-day retention window comes back to life.
 *
 * Token: stateless HMAC over `${userId}|${expiresAtMs}`
 * (`reactivation-token.ts`). Side-effect-driven single-use:
 *
 *   - Fresh delete → token works → restoreUser flips deletedAt
 *     null → next call finds an already-active row → still returns
 *     200 (idempotent).
 *   - Past 7 days → AccountPurger has hard-deleted the row →
 *     restoreUser returns false → 404 ACCOUNT_NOT_RECOVERABLE.
 *   - Wrong / expired / tampered token → 401 REACTIVATION_INVALID.
 *
 * The endpoint does NOT auto-issue a session. The user redirects
 * to /login + signs in fresh — same posture password-reset uses,
 * keeps the borrowed-device story consistent.
 *
 * Installed by prompt [V.UX.33].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { NotFoundError, UnauthorizedError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';
import { verifyReactivationToken } from '../infrastructure/reactivation-token';

export interface ReactivateAccountCommand {
  readonly token: string;
}

@Injectable()
export class ReactivateAccountUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter,
  ) {}

  async execute(cmd: ReactivateAccountCommand): Promise<{ userId: string }> {
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const verified = verifyReactivationToken(cmd.token, pepper);
    if (!verified) {
      throw new UnauthorizedError(
        'Reactivation link is invalid or expired',
        {},
        'REACTIVATION_INVALID',
      );
    }
    const restored = await this.deleter.restoreUser(verified.userId);
    if (!restored) {
      // The 7-day window already closed (purger swept the row) OR
      // the user was never actually soft-deleted. Either way the
      // user can't reactivate — treat as a hard 404 so the UI shows
      // the "create a fresh account" path.
      throw new NotFoundError(
        'Account is not recoverable',
        { userId: verified.userId },
        'ACCOUNT_NOT_RECOVERABLE',
      );
    }
    return { userId: verified.userId };
  }
}
