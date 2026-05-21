/**
 * POST.2B.1 — Prisma adapter for user blocks.
 *
 * `existsBetween` checks both directions in one query.
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { UserBlock as PrismaUserBlock } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { UserBlock } from '../domain/user-block.entity';
import type { BlockRepository } from '../application/ports/block.repository';

function toDomain(row: PrismaUserBlock): UserBlock {
  return { blockerId: row.blockerId, blockedId: row.blockedId, createdAt: row.createdAt };
}

@Injectable()
export class PrismaBlockRepository implements BlockRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedId: string): Promise<UserBlock> {
    const row = await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    return toDomain(row);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  async existsBetween(a: string, b: string): Promise<boolean> {
    const n = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return n > 0;
  }

  async listBlockedUserIds(userId: string): Promise<readonly string[]> {
    const rows = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      // Collect the OTHER party of each edge — never `userId` itself.
      ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
    }
    return [...ids];
  }
}
