/**
 * Flip `read = true` on a notification the caller owns. Idempotent —
 * re-marking an already-read row returns the row unchanged (the
 * repo's updateMany hits count=1 even when the value doesn't
 * actually change, which is the Postgres semantics).
 *
 * IDOR defence: wrong-id OR wrong-owner collapse to the same 404
 * `NOTIFICATION_NOT_FOUND`. A stranger who guesses a cuid learns
 * nothing about which ids exist under other users.
 *
 * Installed by prompt [IV.18.15.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { NotificationLog } from '../domain/notification-log.entity';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

export interface MarkNotificationReadCommand {
  readonly id: string;
  readonly userId: string;
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repo: NotificationLogRepository,
  ) {}

  async execute(cmd: MarkNotificationReadCommand): Promise<NotificationLog> {
    const updated = await this.repo.markReadForUser(cmd.id, cmd.userId);
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
