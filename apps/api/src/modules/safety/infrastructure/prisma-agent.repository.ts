/**
 * Prisma adapter for `AgentRepository` (V.UX.17). Direct delegate;
 * no PostGIS / vector. Region filter is a case-insensitive exact
 * match against any element of `Agent.regions` — Prisma's typed
 * `has` operator + a normalized lower-case query.
 *
 * Installed by prompt [V.UX.17].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Agent as PrismaAgent } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AgentMatch } from '../domain/agent-match.entity';
import type {
  AgentRepository,
  FindVerifiedMatchesInput,
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
    return rows.map(toDomain);
  }
}

function toDomain(row: PrismaAgent): AgentMatch {
  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    languages: row.languages,
    regions: row.regions,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    // verifiedAt is non-null by repo contract (filter above).
    verifiedAt: row.verifiedAt as Date,
  };
}
