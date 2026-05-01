/**
 * List the caller's own NotificationLog rows, most-recent-first.
 * Reads through the repo port; default 50, cap 200 — same shape
 * as `ListMySosEventsUseCase`.
 *
 * Optional `channel` filter narrows to a single delivery channel
 * (push / email / sms) so a channel-segmented inbox view (e.g.
 * "push tab") doesn't have to client-filter the union.
 * Channel filter added by `[IV.18.12.13]`.
 *
 * Installed by prompt [IV.18.15.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel, NotificationLog } from '../domain/notification-log.entity';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) private readonly repo: NotificationLogRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    channel?: NotificationChannel,
    includeArchived = false,
  ): Promise<readonly NotificationLog[]> {
    const clamped =
      limit === undefined ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
    return this.repo.listForUser(userId, clamped, channel, includeArchived);
  }
}
