/**
 * Owner-scoped notification hard-delete. Closes the inbox-management
 * arc that started with `markRead` ([IV.18.15.2]) — users can now
 * curate their inbox instead of just flagging-as-read in perpetuity.
 *
 * Wrong-id and wrong-owner both collapse to 404
 * `NOTIFICATION_NOT_FOUND` (IDOR-safe — same policy as the read /
 * unread verbs). NotificationLog has no FK dependents, so the
 * delete is trivially safe; no cascade concerns.
 *
 * Installed by prompt [IV.18.15.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

export interface DeleteNotificationCommand {
  readonly id: string;
  readonly userId: string;
}

@Injectable()
export class DeleteNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) private readonly repo: NotificationLogRepository,
  ) {}

  async execute(cmd: DeleteNotificationCommand): Promise<void> {
    const ok = await this.repo.deleteForUser(cmd.id, cmd.userId);
    if (!ok) {
      throw new NotFoundError(
        `Notification not found: ${cmd.id}`,
        { notificationId: cmd.id },
        'NOTIFICATION_NOT_FOUND',
      );
    }
  }
}
