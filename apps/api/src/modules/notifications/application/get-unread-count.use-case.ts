/**
 * Count the caller's unread notifications. Drives the
 * home-screen unread badge — clients render "5" without
 * paginating the inbox via `GET /me`.
 *
 * Returns `{ unread: number }` (NOT a bare integer) so the
 * response shape is stable when the surface evolves to
 * include extra fields (e.g. `unread_critical`, `last_at`).
 *
 * Empty inbox → `{ unread: 0 }` (NOT 404). Same precedent as
 * the review summary + mark-all-read endpoints.
 *
 * Installed by prompt [IV.18.15.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';

@Injectable()
export class GetUnreadCountUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repo: NotificationLogRepository,
  ) {}

  async execute(userId: string): Promise<{ unread: number }> {
    const unread = await this.repo.countUnreadForUser(userId);
    return { unread };
  }
}
