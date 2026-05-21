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
import type { FollowEdgeUser, FollowRepository } from '../application/ports/follow.repository';

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

  async countFollowing(followerId: string): Promise<number> {
    return this.prisma.follow.count({ where: { followerId } });
  }

  async listFollowers(followeeId: string, limit: number): Promise<readonly FollowEdgeUser[]> {
    const edges = await this.prisma.follow.findMany({
      where: { followeeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return this.joinUsers(edges.map((e) => ({ otherId: e.followerId, followedAt: e.createdAt })));
  }

  async listFollowing(followerId: string, limit: number): Promise<readonly FollowEdgeUser[]> {
    const edges = await this.prisma.follow.findMany({
      where: { followerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return this.joinUsers(edges.map((e) => ({ otherId: e.followeeId, followedAt: e.createdAt })));
  }

  /**
   * Resolve display names for a set of follow edges. `Follow` is
   * FK-less so there's no relation to `include` — one `user.findMany`
   * joins names in. Soft-deleted users (`deletedAt` set) are dropped:
   * a removed account shouldn't surface in a connections list. Order
   * is preserved from the (already newest-first) edge list.
   */
  private async joinUsers(
    edges: readonly { otherId: string; followedAt: Date }[],
  ): Promise<readonly FollowEdgeUser[]> {
    if (edges.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: edges.map((e) => e.otherId) }, deletedAt: null },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));
    const out: FollowEdgeUser[] = [];
    for (const e of edges) {
      const displayName = nameById.get(e.otherId);
      if (displayName === undefined) continue; // dropped: deleted user
      out.push({ userId: e.otherId, displayName, followedAt: e.followedAt });
    }
    return out;
  }
}
