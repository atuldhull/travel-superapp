/**
 * Prisma adapter for `VoteRepository`. Direct Prisma — no PostGIS,
 * no raw SQL. The UNIQUE index on `(tripId, userId, targetType,
 * targetId)` is what makes `upsert` atomic; Prisma's `upsert`
 * matches on that compound unique.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Vote as PrismaVote } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Vote, VoteTargetType, VoteValue } from '../domain/vote.entity';
import type {
  DeleteVoteInput,
  FindVoteInput,
  UpsertVoteInput,
  VoteRepository,
} from '../application/ports/vote.repository';

@Injectable()
export class PrismaVoteRepository implements VoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsert(input: UpsertVoteInput): Promise<Vote> {
    const row = await this.prisma.vote.upsert({
      where: {
        tripId_userId_targetType_targetId: {
          tripId: input.tripId,
          userId: input.userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      create: {
        tripId: input.tripId,
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        value: input.value,
      },
      update: { value: input.value },
    });
    return toDomain(row);
  }

  async deleteForUser(input: DeleteVoteInput): Promise<boolean> {
    const result = await this.prisma.vote.deleteMany({
      where: {
        tripId: input.tripId,
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    });
    return result.count === 1;
  }

  async listForTrip(tripId: string): Promise<readonly Vote[]> {
    const rows = await this.prisma.vote.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async findForUser(input: FindVoteInput): Promise<Vote | null> {
    const row = await this.prisma.vote.findUnique({
      where: {
        tripId_userId_targetType_targetId: {
          tripId: input.tripId,
          userId: input.userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
    });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: PrismaVote): Vote {
  return {
    id: row.id,
    tripId: row.tripId,
    userId: row.userId,
    targetType: row.targetType as VoteTargetType,
    targetId: row.targetId,
    value: row.value as VoteValue,
    createdAt: row.createdAt,
  };
}
