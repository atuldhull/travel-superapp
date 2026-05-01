/**
 * Prisma adapter for `PushSubscriptionRepository`.
 *
 * `endpoint` is the unique key. Re-subscribing the same browser
 * endpoint under a different user account takes ownership — the
 * browser-vendor URL is install-scoped, not user-scoped.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { PushSubscription as PrismaPushSubscription } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { PushSubscription } from '../domain/push-subscription.entity';
import type {
  PushSubscriptionRepository,
  UpsertPushSubscriptionInput,
} from '../application/ports/push-subscription.repository';

@Injectable()
export class PrismaPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsertByEndpoint(input: UpsertPushSubscriptionInput): Promise<PushSubscription> {
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      },
      update: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
      },
    });
    return toDomain(row);
  }

  async listForUser(userId: string): Promise<readonly PushSubscription[]> {
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<boolean> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return result.count === 1;
  }

  async deleteExpiredEndpoint(endpoint: string): Promise<void> {
    // 410 Gone reaper — no owner check; the endpoint is dead
    // regardless of which user it was attached to.
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}

function toDomain(row: PrismaPushSubscription): PushSubscription {
  return {
    id: row.id,
    userId: row.userId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
