/**
 * V.UX.26 — soft-archive a notification (swipe-to-archive). Same
 * IDOR posture as `delete-notification.use-case.ts` — wrong-id and
 * wrong-owner both collapse to 404 `NOTIFICATION_NOT_FOUND`.
 *
 * Idempotent: re-archiving a row that's already archived succeeds
 * without touching the timestamp.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

export interface ArchiveNotificationCommand {
  readonly id: string;
  readonly userId: string;
}

@Injectable()
export class ArchiveNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repo: NotificationLogRepository,
  ) {}

  async execute(cmd: ArchiveNotificationCommand): Promise<void> {
    const ok = await this.repo.archiveForUser(cmd.id, cmd.userId);
    if (!ok) {
      throw new NotFoundError(
        `Notification not found: ${cmd.id}`,
        { notificationId: cmd.id },
        'NOTIFICATION_NOT_FOUND',
      );
    }
  }
}
