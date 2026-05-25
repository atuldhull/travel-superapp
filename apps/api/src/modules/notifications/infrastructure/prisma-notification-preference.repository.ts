/**
 * Prisma adapter for `NotificationPreferenceRepository`.
 *
 * Synthesises a default-shape row when the user has never written
 * preferences (mirrors `PrismaPreferencesRepository.getOrDefault` in
 * the account module so consumers don't branch on null).
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import type { NotificationPreference as PrismaNotificationPreference } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  NotificationCategory,
  NotificationPreference,
} from '../domain/notification-preference.entity';
import type {
  NotificationPreferenceRepository,
  UpsertNotificationPreferenceInput,
} from '../application/ports/notification-preference.repository';

@Injectable()
export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getOrDefault(userId: string): Promise<NotificationPreference> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (row) return toDomain(row);
    const now = this.clock.now();
    return {
      id: '',
      userId,
      push: true,
      email: true,
      sms: false,
      categoriesDisabled: [],
      lastDigestSentAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreference> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        push: input.push ?? true,
        email: input.email ?? true,
        sms: input.sms ?? false,
        categoriesDisabled: input.categoriesDisabled ? [...input.categoriesDisabled] : [],
      },
      update: {
        ...(input.push !== undefined ? { push: input.push } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.sms !== undefined ? { sms: input.sms } : {}),
        ...(input.categoriesDisabled !== undefined
          ? { categoriesDisabled: [...input.categoriesDisabled] }
          : {}),
      },
    });
    return toDomain(row);
  }

  async markDigestSent(userId: string, at: Date): Promise<void> {
    // Upsert is the safest shape — the user may not have written
    // prefs yet but is still a valid digest target by virtue of
    // having received notifications.
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, lastDigestSentAt: at },
      update: { lastDigestSentAt: at },
    });
  }

  async listEligibleForDigest(): Promise<readonly NotificationPreference[]> {
    // "Has email on AND digest category not disabled". The scheduler
    // filters further by per-user timezone + lastDigestSentAt window.
    const rows = await this.prisma.notificationPreference.findMany({
      where: {
        email: true,
        NOT: { categoriesDisabled: { has: 'digest' } },
      },
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: PrismaNotificationPreference): NotificationPreference {
  return {
    id: row.id,
    userId: row.userId,
    push: row.push,
    email: row.email,
    sms: row.sms,
    categoriesDisabled: row.categoriesDisabled as NotificationCategory[],
    lastDigestSentAt: row.lastDigestSentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
