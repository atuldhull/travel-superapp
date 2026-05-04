/**
 * Admin-driven user unban. V.UX.34 — clears `User.bannedAt +
 * banReason` back to null. Sessions stay revoked (the user
 * re-authenticates fresh; we don't restore tokens issued before
 * the ban).
 *
 * 404 paths:
 *   - User row missing.
 *   - User row exists but was never banned (`bannedAt` already null).
 *
 * Installed by prompt [IV.18.18.1]; bannedAt-based wiring added in
 * [V.UX.34].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

@Injectable()
export class AdminUnbanUserUseCase {
  constructor(@Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter) {}

  async execute(targetUserId: string): Promise<void> {
    const ok = await this.deleter.unbanUser(targetUserId);
    if (!ok) throw new UserNotFoundError(targetUserId);
  }
}
