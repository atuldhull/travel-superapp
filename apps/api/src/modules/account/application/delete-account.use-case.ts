/**
 * Right-to-erasure use case (GDPR Art. 17 / DPDP §12 / COPPA
 * parental delete).
 *
 *   - Sets `User.deletedAt = now()` on the caller's row.
 *   - Revokes ALL live sessions for the user atomically with the
 *     soft-delete (single Prisma transaction in the adapter).
 *
 * Effect: subsequent login fails (the user repository filters
 * `deletedAt != null` rows out as absent — same path that an
 * unregistered user takes, returning `INVALID_CREDENTIALS`).
 * Refresh fails (the refresh use-case re-fetches the user and
 * sees the soft-deleted row treated as missing →
 * `REFRESH_USER_MISSING`). Access tokens already issued continue
 * to verify until they expire (15-minute TTL), which is the
 * documented v1 limitation — the alternative would be a per-
 * request DB lookup on every authed call. The session revoke
 * caps the worst-case window at 15 minutes.
 *
 * The hard-delete sweep (cron that wipes rows after a 7-day
 * window) is the natural follow-up — Prisma's `onDelete:
 * Cascade` on every user-scoped FK then wipes the dependent
 * rows automatically. Not in this slice.
 *
 * Installed by prompt [IV.18.16.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

@Injectable()
export class DeleteAccountUseCase {
  constructor(@Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter) {}

  async execute(userId: string): Promise<void> {
    const ok = await this.deleter.softDeleteAndRevokeSessions(userId, new Date());
    if (!ok) throw new UserNotFoundError(userId);
  }
}
