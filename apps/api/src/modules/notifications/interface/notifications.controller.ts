/**
 * Notifications HTTP surface.
 *
 *   GET  /api/v1/notifications/me              — list the authed
 *                                                user's recent
 *                                                deliveries.
 *   GET  /api/v1/notifications/me/unread-count  — `{ unread: N }`
 *                                                badge primitive
 *                                                without paginating
 *                                                the inbox.
 *   POST /api/v1/notifications/:id/read         — flip `read = true`
 *                                                on a notification
 *                                                the caller owns.
 *                                                Idempotent.
 *   POST /api/v1/notifications/read-all         — flip `read = true`
 *                                                on every unread row
 *                                                for the caller.
 *                                                Returns `{ marked }`.
 *                                                Idempotent.
 *
 * Per-channel filtering lands in a follow-up slice. Any future
 * "mark-as-unread" verb belongs here too.
 *
 * Installed by prompt [IV.18.15.1]. `POST /:id/read` added in
 * [IV.18.15.2]. `POST /read-all` added in [IV.18.15.3].
 * `GET /me/unread-count` added in [IV.18.15.4].
 */
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { GetUnreadCountUseCase } from '../application/get-unread-count.use-case';
import { ListMyNotificationsUseCase } from '../application/list-my-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from '../application/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from '../application/mark-notification-read.use-case';
import { MarkNotificationUnreadUseCase } from '../application/mark-notification-unread.use-case';
import type { NotificationLog } from '../domain/notification-log.entity';

interface NotificationLogDto {
  readonly id: string;
  readonly channel: string;
  readonly templateId: string;
  readonly status: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly read: boolean;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
}

function toDto(n: NotificationLog): NotificationLogDto {
  return {
    id: n.id,
    channel: n.channel,
    templateId: n.templateId,
    status: n.status,
    payload: n.payload,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
  };
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listUc: ListMyNotificationsUseCase,
    private readonly markReadUc: MarkNotificationReadUseCase,
    private readonly markAllReadUc: MarkAllNotificationsReadUseCase,
    private readonly unreadCountUc: GetUnreadCountUseCase,
    private readonly markUnreadUc: MarkNotificationUnreadUseCase,
  ) {}

  /**
   * Declared BEFORE `me` — Nest matches in declaration order, and
   * `me/unread-count` is a more specific path that should land
   * here, not on the `me` lister. Defensive ordering even though
   * Nest's path matcher would resolve segment counts correctly.
   */
  @Get('me/unread-count')
  @HttpCode(HttpStatus.OK)
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return this.unreadCountUc.execute(user.sub);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ notifications: NotificationLogDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    const rows = await this.listUc.execute(user.sub, parsed);
    return { notifications: rows.map(toDto) };
  }

  /**
   * Declared BEFORE `:id/read` — Nest matches in declaration order
   * and `read-all` is a literal segment, but explicit ordering
   * prevents a future `:id` route definition from accidentally
   * shadowing it. Same defensive pattern used by `/reviews/summary`
   * and the public memory-book routes.
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ marked: number }> {
    return this.markAllReadUc.execute(user.sub);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationLogDto> {
    const row = await this.markReadUc.execute({ id, userId: user.sub });
    return toDto(row);
  }

  @Post(':id/unread')
  @HttpCode(HttpStatus.OK)
  async markUnread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationLogDto> {
    const row = await this.markUnreadUc.execute({ id, userId: user.sub });
    return toDto(row);
  }
}
