/**
 * Notifications HTTP surface.
 *
 *   GET  /api/v1/notifications/me       — list the authed user's
 *                                         recent deliveries.
 *   POST /api/v1/notifications/:id/read — flip `read = true` on
 *                                         a notification the caller
 *                                         owns. Idempotent.
 *
 * Per-channel filtering + a bulk mark-all-read land in follow-up
 * slices. Any future "mark-as-unread" verb belongs here too.
 *
 * Installed by prompt [IV.18.15.1]. `POST /:id/read` added in
 * [IV.18.15.2].
 */
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ListMyNotificationsUseCase } from '../application/list-my-notifications.use-case';
import { MarkNotificationReadUseCase } from '../application/mark-notification-read.use-case';
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
  ) {}

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

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationLogDto> {
    const row = await this.markReadUc.execute({ id, userId: user.sub });
    return toDto(row);
  }
}
