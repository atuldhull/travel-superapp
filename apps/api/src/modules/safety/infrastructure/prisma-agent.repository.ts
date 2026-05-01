/**
 * Prisma adapter for `AgentRepository` (V.UX.17 marketplace match
 * + V.UX.24 caller-self profile / dashboard surfaces). Direct
 * delegate; no PostGIS / vector.
 *
 * Installed by prompt [V.UX.17]; agent-self surface added in
 * prompt [V.UX.24].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Agent as PrismaAgent, Review as PrismaReview } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AgentMatch } from '../domain/agent-match.entity';
import type {
  AgentBookingSummary,
  AgentEarningsSummary,
  AgentEscrowState,
  AgentKycStatus,
  AgentProfile,
  AgentReviewWithResponse,
} from '../domain/agent-profile.entity';
import type {
  AgentRepository,
  FindVerifiedMatchesInput,
  UpdateAgentProfileInput,
} from '../application/ports/agent.repository';

@Injectable()
export class PrismaAgentRepository implements AgentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findVerifiedMatches(input: FindVerifiedMatchesInput): Promise<readonly AgentMatch[]> {
    const region = input.region?.trim();
    const where: {
      kycStatus: 'verified';
      verifiedAt: { not: null };
      regions?: { has: string };
    } = {
      kycStatus: 'verified',
      verifiedAt: { not: null },
    };
    if (region && region.length > 0) {
      where.regions = { has: region };
    }
    const rows = await this.prisma.agent.findMany({
      where,
      orderBy: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }, { verifiedAt: 'desc' }],
      take: Math.min(Math.max(input.limit, 1), 10),
    });
    return rows.map(toMatch);
  }

  async findByUserId(userId: string): Promise<AgentProfile | null> {
    const row = await this.prisma.agent.findUnique({ where: { userId } });
    return row ? toProfile(row) : null;
  }

  async updateForUser(input: UpdateAgentProfileInput): Promise<AgentProfile | null> {
    // updateMany returns count + rows aren't echoed; do a follow-up
    // findUnique to return the fresh shape. The (userId) unique
    // index keeps this to two cheap reads.
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) data['displayName'] = input.displayName;
    if (input.bio !== undefined) data['bio'] = input.bio;
    if (input.languages !== undefined) data['languages'] = [...input.languages];
    if (input.regions !== undefined) data['regions'] = [...input.regions];

    const result = await this.prisma.agent.updateMany({
      where: { userId: input.userId },
      data,
    });
    if (result.count === 0) return null;
    const row = await this.prisma.agent.findUnique({ where: { userId: input.userId } });
    return row ? toProfile(row) : null;
  }

  async listBookingsForAgent(input: {
    readonly agentId: string;
    readonly since: Date;
    readonly limit: number;
  }): Promise<readonly AgentBookingSummary[]> {
    const rows = await this.prisma.escrowHold.findMany({
      where: { agentId: input.agentId, heldAt: { gte: input.since } },
      orderBy: { heldAt: 'desc' },
      take: Math.min(Math.max(input.limit, 1), 100),
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      amountUsd: r.amountUsd.toFixed(2),
      currency: r.currency,
      state: r.state as AgentEscrowState,
      heldAt: r.heldAt,
      releasedAt: r.releasedAt,
      refundedAt: r.refundedAt,
    }));
  }

  async sumEarningsForAgent(input: {
    readonly agentId: string;
    readonly since: Date;
  }): Promise<AgentEarningsSummary> {
    const agg = await this.prisma.escrowHold.aggregate({
      where: {
        agentId: input.agentId,
        heldAt: { gte: input.since },
        state: { in: ['held', 'released'] },
      },
      _sum: { amountUsd: true },
      _count: { _all: true },
    });
    const sum = agg._sum.amountUsd;
    return {
      grossUsd: sum === null ? '0.00' : sum.toFixed(2),
      bookingsCount: agg._count._all,
    };
  }

  async listReviewsForAgent(input: {
    readonly agentId: string;
    readonly limit: number;
  }): Promise<readonly AgentReviewWithResponse[]> {
    const rows = await this.prisma.review.findMany({
      where: { targetType: 'agent', targetId: input.agentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(input.limit, 1), 100),
    });
    return rows.map(toReview);
  }
}

function toMatch(row: PrismaAgent): AgentMatch {
  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    languages: row.languages,
    regions: row.regions,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    // verifiedAt is non-null by repo contract (filter in findVerifiedMatches).
    verifiedAt: row.verifiedAt as Date,
  };
}

function toProfile(row: PrismaAgent): AgentProfile {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    bio: row.bio,
    kycStatus: row.kycStatus as AgentKycStatus,
    verifiedAt: row.verifiedAt,
    languages: row.languages,
    regions: row.regions,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toReview(row: PrismaReview): AgentReviewWithResponse {
  return {
    id: row.id,
    authorId: row.authorId,
    rating: row.rating,
    body: row.body,
    language: row.language,
    verifiedBooking: row.verifiedBooking,
    responseBody: row.responseBody,
    responseAt: row.responseAt,
    createdAt: row.createdAt,
  };
}
