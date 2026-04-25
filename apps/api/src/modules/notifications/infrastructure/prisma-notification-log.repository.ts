/**
 * Prisma adapter for `NotificationLogRepository`. Direct Prisma
 * delegate — no PostGIS / vector / raw SQL involved. The
 * `payload` column is JSONB and accepts any structured object;
 * we trust the caller to put bounded sizes in there.
 *
 * Installed by prompt [IV.18.15.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type {
  NotificationChannel as PrismaNotificationChannel,
  NotificationDeliveryStatus as PrismaNotificationDeliveryStatus,
  NotificationLog as PrismaNotificationLog,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationLog,
} from '../domain/notification-log.entity';
import type {
  CreateNotificationLogInput,
  NotificationLogRepository,
} from '../application/ports/notification-log.repository';

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationLogInput): Promise<NotificationLog> {
    const row = await this.prisma.notificationLog.create({
      data: {
        userId: input.userId,
        channel: input.channel as PrismaNotificationChannel,
        templateId: input.templateId,
        status: input.status as PrismaNotificationDeliveryStatus,
        payload: input.payload as Prisma.InputJsonValue,
        deliveredAt: input.deliveredAt,
      },
    });
    return toDomain(row);
  }

  async listForUser(userId: string, limit: number): Promise<readonly NotificationLog[]> {
    const rows = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toDomain);
  }

  async markReadForUser(id: string, userId: string): Promise<NotificationLog | null> {
    // Owner-scoped `updateMany` + count gate — same shape the
    // Media module uses for `markReady` + `setTripForOwner`. A
    // row that's already `read: true` still gets count=1 from
    // Postgres, so the operation is naturally idempotent.
    const result = await this.prisma.notificationLog.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.notificationLog.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async markAllReadForUser(userId: string): Promise<number> {
    // Owner-scoped + `read: false` clause — Postgres skips already-
    // read rows, so the cost scales with unread count not inbox
    // size. The `[userId, read, createdAt]` index on NotificationLog
    // makes the lookup of unread rows cheap (it's the same index
    // the unread-badge query uses).
    const result = await this.prisma.notificationLog.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }

  async countUnreadForUser(userId: string): Promise<number> {
    // Same `[userId, read, createdAt]` index as markAllReadForUser.
    // Postgres `count` on an indexed-prefix `where` is O(log n) +
    // a heap-only-tuple scan of the matching range — cheap even
    // at large inbox sizes.
    return this.prisma.notificationLog.count({
      where: { userId, read: false },
    });
  }

  async markUnreadForUser(id: string, userId: string): Promise<NotificationLog | null> {
    // Symmetric to `markReadForUser`. Same `updateMany` + count
    // gate; owner-scoped on `(id, userId)` for IDOR safety. Already-
    // unread rows still get count=1 (Postgres updates the row even
    // when values match), so the operation is idempotent.
    const result = await this.prisma.notificationLog.updateMany({
      where: { id, userId },
      data: { read: false },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.notificationLog.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: PrismaNotificationLog): NotificationLog {
  return {
    id: row.id,
    userId: row.userId,
    channel: row.channel as NotificationChannel,
    templateId: row.templateId,
    status: row.status as NotificationDeliveryStatus,
    payload: (row.payload ?? {}) as Readonly<Record<string, unknown>>,
    read: row.read,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
  };
}
