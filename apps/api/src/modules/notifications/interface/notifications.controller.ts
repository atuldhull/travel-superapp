/**
 * Notifications HTTP surface (v1).
 *
 *   GET /api/v1/notifications/me — list the authed user's recent
 *                                  notification deliveries
 *                                  (most-recent-first, default 50,
 *                                  cap 200).
 *
 * Mark-as-read + per-channel filtering land in follow-up slices —
 * v1 is just the read view of the ledger that subscribers
 * populate.
 *
 * Installed by prompt [IV.18.15.1].
 */
import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ListMyNotificationsUseCase } from '../application/list-my-notifications.use-case';
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
  constructor(private readonly listUc: ListMyNotificationsUseCase) {}

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
}
