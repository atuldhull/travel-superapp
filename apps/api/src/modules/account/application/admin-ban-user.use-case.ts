/**
 * Admin-driven user ban. Reuses the same `AccountDeleter` port
 * the user-self-delete flow uses (`[IV.18.16.2]`) — the
 * operation is identical: set `deletedAt = now()` + revoke
 * sessions atomically. The only difference is the auth posture
 * (admin role gate vs. self-bearer) and which user id gets
 * passed in.
 *
 * The hard-delete cron (`[IV.18.16.3]`) eventually sweeps the
 * banned row 7 days later — same retention window as a
 * self-delete. An admin who wants to wipe a user immediately
 * runs the future "force-purge" admin endpoint (queued slice).
 *
 * Installed by prompt [IV.18.18.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

@Injectable()
export class AdminBanUserUseCase {
  constructor(@Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter) {}

  async execute(targetUserId: string): Promise<void> {
    const ok = await this.deleter.softDeleteAndRevokeSessions(targetUserId, new Date());
    if (!ok) throw new UserNotFoundError(targetUserId);
  }
}
