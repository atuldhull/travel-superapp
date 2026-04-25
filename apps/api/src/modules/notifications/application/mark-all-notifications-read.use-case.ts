/**
 * Mark every unread notification for the caller as read.
 * "Clear the badge" companion to `POST /:id/read` — saves clients
 * an N-round-trip walk over the inbox.
 *
 * Returns the number of rows actually flipped. Empty inbox or
 * already-fully-read inbox returns `0` (NOT 404) — the operation
 * is idempotent by construction, and a 404 here would lie about
 * the caller's own inbox.
 *
 * Installed by prompt [IV.18.15.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repo: NotificationLogRepository,
  ) {}

  async execute(userId: string): Promise<{ marked: number }> {
    const marked = await this.repo.markAllReadForUser(userId);
    return { marked };
  }
}
