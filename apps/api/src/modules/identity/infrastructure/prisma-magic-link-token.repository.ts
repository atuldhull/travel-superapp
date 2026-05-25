/**
 * Prisma adapter for `MagicLinkTokenRepository`. The atomic consume
 * uses an `updateMany({ where: { tokenHash, consumedAt: null,
 * expiresAt: { gt: now } } })` and inspects `count` — same
 * owner-scoped-write pattern used elsewhere in the api (ADR-012).
 *
 * Installed by prompt [V.UX.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from '../../../common/db/prisma.service';
import type { MagicLinkToken } from '../domain/magic-link-token.entity';
import type { MagicLinkTokenRepository } from '../application/ports/magic-link-token.repository';

@Injectable()
export class PrismaMagicLinkTokenRepository implements MagicLinkTokenRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(input: {
    readonly emailHash: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<MagicLinkToken> {
    const row = await this.prisma.magicLinkToken.create({
      data: {
        emailHash: input.emailHash,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return row;
  }

  async findActiveByHash(tokenHash: string): Promise<MagicLinkToken | null> {
    const row = await this.prisma.magicLinkToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    if (row.consumedAt !== null) return null;
    if (row.expiresAt.getTime() <= this.clock.nowMs()) return null;
    return row;
  }

  async consume(tokenHash: string, now: Date): Promise<MagicLinkToken | null> {
    // updateMany + count guard mirrors the owner-scoped-write pattern
    // used elsewhere (ADR-012). count==1 means we won the single-use
    // race; we then read the now-consumed row to return the emailHash.
    const result = await this.prisma.magicLinkToken.updateMany({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (result.count !== 1) return null;
    // Re-fetch the row (now-consumed) to surface the emailHash to the
    // use-case. Single round trip — Prisma resolves by unique index.
    const row = await this.prisma.magicLinkToken.findUnique({ where: { tokenHash } });
    return row;
  }

  async countRecentForEmail(emailHash: string, withinMs: number): Promise<number> {
    const since = new Date(this.clock.nowMs() - withinMs);
    return this.prisma.magicLinkToken.count({
      where: { emailHash, createdAt: { gte: since } },
    });
  }
}
