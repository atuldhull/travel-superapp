/**
 * Symmetric companion to `MarkNotificationReadUseCase`. Flips
 * `read = false` on a notification the caller owns. Useful when
 * the user accidentally read something they wanted to come back
 * to.
 *
 * IDOR defence: wrong-id OR wrong-owner collapse to the same 404
 * `NOTIFICATION_NOT_FOUND`. Same posture mark-read uses.
 *
 * Idempotent: re-marking an already-unread row returns the row
 * unchanged.
 *
 * Installed by prompt [IV.18.15.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { NotificationLog } from '../domain/notification-log.entity';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

export interface MarkNotificationUnreadCommand {
  readonly id: string;
  readonly userId: string;
}

@Injectable()
export class MarkNotificationUnreadUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repo: NotificationLogRepository,
  ) {}

  async execute(cmd: MarkNotificationUnreadCommand): Promise<NotificationLog> {
    const updated = await this.repo.markUnreadForUser(cmd.id, cmd.userId);
    if (!updated) {
      throw new NotFoundError(
        `Notification not found: ${cmd.id}`,
        { notificationId: cmd.id },
        'NOTIFICATION_NOT_FOUND',
      );
    }
    return updated;
  }
}
