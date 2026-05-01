/**
 * Notifications HTTP surface.
 *
 *   GET  /api/v1/notifications/me              — list the authed
 *                                                user's recent
 *                                                deliveries. Optional
 *                                                ?channel=push|email|sms
 *                                                narrows to one
 *                                                delivery channel
 *                                                ([IV.18.12.13]).
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
 *   DELETE /api/v1/notifications/:id            — owner hard-delete.
 *                                                Inbox prune.
 *                                                ([IV.18.15.6]).
 *
 * Per-channel filtering shipped in `[IV.18.12.13]` via the
 * `?channel=push|email|sms` query param on `GET /me`. Any
 * future "mark-as-unread" verb belongs here too.
 *
 * Installed by prompt [IV.18.15.1]. `POST /:id/read` added in
 * [IV.18.15.2]. `POST /read-all` added in [IV.18.15.3].
 * `GET /me/unread-count` added in [IV.18.15.4].
 */
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import {
  ListMyNotificationsResponseDto,
  MarkAllReadResponseDto,
  NotificationLogDto as NotificationLogResponseDto,
  UnreadCountResponseDto,
} from './dto/notifications-response.dto';
import { ArchiveNotificationUseCase } from '../application/archive-notification.use-case';
import { DeleteNotificationUseCase } from '../application/delete-notification.use-case';
import { GetUnreadCountUseCase } from '../application/get-unread-count.use-case';
import { ListMyNotificationsUseCase } from '../application/list-my-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from '../application/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from '../application/mark-notification-read.use-case';
import { MarkNotificationUnreadUseCase } from '../application/mark-notification-unread.use-case';
import type { NotificationChannel, NotificationLog } from '../domain/notification-log.entity';

const VALID_CHANNELS: readonly NotificationChannel[] = ['push', 'email', 'sms'];

interface NotificationLogDto {
  readonly id: string;
  readonly channel: string;
  readonly templateId: string;
  readonly status: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly read: boolean;
  readonly archivedAt: string | null;
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
    archivedAt: n.archivedAt ? n.archivedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    deliveredAt: n.deliveredAt ? n.deliveredAt.toISOString() : null,
  };
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listUc: ListMyNotificationsUseCase,
    private readonly markReadUc: MarkNotificationReadUseCase,
    private readonly markAllReadUc: MarkAllNotificationsReadUseCase,
    private readonly unreadCountUc: GetUnreadCountUseCase,
    private readonly markUnreadUc: MarkNotificationUnreadUseCase,
    private readonly deleteUc: DeleteNotificationUseCase,
    private readonly archiveUc: ArchiveNotificationUseCase,
  ) {}

  /**
   * Declared BEFORE `me` — Nest matches in declaration order, and
   * `me/unread-count` is a more specific path that should land
   * here, not on the `me` lister. Defensive ordering even though
   * Nest's path matcher would resolve segment counts correctly.
   */
  @ApiOperation({
    summary: 'Returns { unread: N } for the home-screen badge. Single indexed COUNT — cheap.',
  })
  @ApiResponse({ status: 200, description: 'Unread count.', type: UnreadCountResponseDto })
  @Get('me/unread-count')
  @HttpCode(HttpStatus.OK)
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return this.unreadCountUc.execute(user.sub);
  }

  @ApiOperation({
    summary:
      "List the caller's recent notifications. Optional ?channel=push|email|sms narrows to one delivery channel.",
  })
  @ApiResponse({
    status: 200,
    description: "Caller's recent deliveries, newest-first.",
    type: ListMyNotificationsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED — channel is not one of push|email|sms.',
  })
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('channel') channel?: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<{ notifications: NotificationLogDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    let parsedChannel: NotificationChannel | undefined;
    if (channel !== undefined) {
      if (!VALID_CHANNELS.includes(channel as NotificationChannel)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `channel must be one of: ${VALID_CHANNELS.join(' | ')}`,
        });
      }
      parsedChannel = channel as NotificationChannel;
    }
    const includeArchivedBool = includeArchived === 'true' || includeArchived === '1';
    const rows = await this.listUc.execute(user.sub, parsed, parsedChannel, includeArchivedBool);
    return { notifications: rows.map(toDto) };
  }

  /**
   * Declared BEFORE `:id/read` — Nest matches in declaration order
   * and `read-all` is a literal segment, but explicit ordering
   * prevents a future `:id` route definition from accidentally
   * shadowing it. Same defensive pattern used by `/reviews/summary`
   * and the public memory-book routes.
   */
  @ApiOperation({
    summary:
      'Mark every unread row as read. Returns { marked: N }. Idempotent (second call returns 0).',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of rows actually flipped.',
    type: MarkAllReadResponseDto,
  })
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ marked: number }> {
    return this.markAllReadUc.execute(user.sub);
  }

  @ApiOperation({
    summary: 'Mark one notification as read. Owner-gated; 404 on cross-user / missing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated notification row.',
    type: NotificationLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'NOTIFICATION_NOT_FOUND.' })
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationLogDto> {
    const row = await this.markReadUc.execute({ id, userId: user.sub });
    return toDto(row);
  }

  @ApiOperation({ summary: 'Mark one notification as UNread (symmetric to /read). Owner-gated.' })
  @ApiResponse({
    status: 200,
    description: 'Updated notification row.',
    type: NotificationLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'NOTIFICATION_NOT_FOUND.' })
  @Post(':id/unread')
  @HttpCode(HttpStatus.OK)
  async markUnread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationLogDto> {
    const row = await this.markUnreadUc.execute({ id, userId: user.sub });
    return toDto(row);
  }

  /**
   * Owner-scoped hard-delete. Lets a user prune their inbox
   * instead of just flagging-as-read in perpetuity. 404 (not 403)
   * on cross-user / missing — IDOR-safe collapsing. Added by
   * `[IV.18.15.6]`.
   */
  @ApiOperation({
    summary: 'Hard-delete a notification (inbox prune). Owner-gated; 404 on cross-user / missing.',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'NOTIFICATION_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, userId: user.sub });
  }

  /**
   * V.UX.26 — soft-archive (swipe-to-archive). Owner-gated; 404 on
   * cross-user / missing. Idempotent. The default lister filters
   * archived rows; pass `?includeArchived=true` to see them again.
   */
  @ApiOperation({
    summary:
      'Soft-archive a notification (swipe-to-archive). Owner-gated; 404 on cross-user / missing. Idempotent.',
  })
  @ApiResponse({ status: 204, description: 'Archived.' })
  @ApiResponse({ status: 404, description: 'NOTIFICATION_NOT_FOUND.' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.archiveUc.execute({ id, userId: user.sub });
  }
}
