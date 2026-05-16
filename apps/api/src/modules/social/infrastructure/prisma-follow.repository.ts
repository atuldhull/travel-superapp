/**
 * POST.2B.1 — Prisma adapter for the follow graph.
 *
 * Idempotent by the composite PK: follow upserts, unfollow uses
 * deleteMany (0 rows = no-op, never throws).
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Follow as PrismaFollow } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Follow } from '../domain/follow.entity';
import type { FollowRepository } from '../application/ports/follow.repository';

function toDomain(row: PrismaFollow): Follow {
  return { followerId: row.followerId, followeeId: row.followeeId, createdAt: row.createdAt };
}

@Injectable()
export class PrismaFollowRepository implements FollowRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async follow(followerId: string, followeeId: string): Promise<Follow> {
    const row = await this.prisma.follow.upsert({
      where: { followerId_followeeId: { followerId, followeeId } },
      create: { followerId, followeeId },
      update: {},
    });
    return toDomain(row);
  }

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    await this.prisma.follow.deleteMany({ where: { followerId, followeeId } });
  }

  async exists(followerId: string, followeeId: string): Promise<boolean> {
    const n = await this.prisma.follow.count({ where: { followerId, followeeId } });
    return n > 0;
  }

  async countFollowers(followeeId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followeeId } });
  }
}
