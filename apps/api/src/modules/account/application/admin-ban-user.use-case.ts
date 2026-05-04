/**
 * Admin-driven user ban. V.UX.34 splits ban from delete: admin sets
 * `User.bannedAt + banReason` (NOT `deletedAt`) + revokes sessions
 * atomically. The two states are independent — a user can be both
 * banned (by admin) and self-deleted (by their own action). The
 * banned check fires FIRST in `LoginUseCase` so a banned user
 * reactivating via the V.UX.33 link still cannot log in.
 *
 * Reason is required (1..280 chars) — empty bans are not useful;
 * the reason is shown to the user on the banned-login page so they
 * can write a meaningful appeal.
 *
 * Installed by prompt [IV.18.18.1]; reason + dedicated bannedAt
 * column added in [V.UX.34].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError, ValidationError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

const REASON_MIN = 1;
const REASON_MAX = 280;

export interface AdminBanUserCommand {
  readonly targetUserId: string;
  readonly reason: string;
}

@Injectable()
export class AdminBanUserUseCase {
  constructor(@Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter) {}

  async execute(cmd: AdminBanUserCommand): Promise<void> {
    const trimmed = cmd.reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      throw new ValidationError(
        `Ban reason must be ${REASON_MIN}..${REASON_MAX} characters`,
        { reason: [`Must be ${REASON_MIN}..${REASON_MAX} characters`] },
        { min: REASON_MIN, max: REASON_MAX },
        'INVALID_BAN_REASON',
      );
    }
    const ok = await this.deleter.banUser(cmd.targetUserId, new Date(), trimmed);
    if (!ok) throw new UserNotFoundError(cmd.targetUserId);
  }
}
