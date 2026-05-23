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
 * V.UX.36 — every successful unban writes one row to AdminAuditLog
 * with `{action:'unban'}`.
 *
 * Installed by prompt [IV.18.18.1]; bannedAt-based wiring added in
 * [V.UX.34]; audit log added in [V.UX.36].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  recordAdminAction,
  type AdminAuditLogRepository,
} from '../../admin';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';

export interface AdminUnbanUserCommand {
  readonly actorId: string;
  readonly targetUserId: string;
}

@Injectable()
export class AdminUnbanUserUseCase {
  constructor(
    @Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY) private readonly audit: AdminAuditLogRepository,
  ) {}

  async execute(cmd: AdminUnbanUserCommand): Promise<void> {
    const ok = await this.deleter.unbanUser(cmd.targetUserId);
    if (!ok) throw new UserNotFoundError(cmd.targetUserId);
    await recordAdminAction(this.audit, {
      actorId: cmd.actorId,
      targetType: 'user',
      targetId: cmd.targetUserId,
      action: 'unban',
    });
  }
}
