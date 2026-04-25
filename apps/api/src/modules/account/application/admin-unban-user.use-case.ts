/**
 * Admin-driven user unban. Reverse of `AdminBanUserUseCase`:
 * clears `User.deletedAt` back to `null` so the user can log in
 * again. Sessions stay revoked — the user re-authenticates
 * fresh, which is the correct posture (we don't restore tokens
 * that were issued before the ban).
 *
 * 404 path:
 *   - User row is gone (hard-delete cron already swept it past
 *     the 7-day window) — restore is no longer possible.
 *   - User row exists but is already active (`deletedAt` null) —
 *     unban-on-active is a client bug; surface it.
 *
 * Installed by prompt [IV.18.18.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

@Injectable()
export class AdminUnbanUserUseCase {
  constructor(@Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter) {}

  async execute(targetUserId: string): Promise<void> {
    const ok = await this.deleter.restoreUser(targetUserId);
    if (!ok) throw new UserNotFoundError(targetUserId);
  }
}
