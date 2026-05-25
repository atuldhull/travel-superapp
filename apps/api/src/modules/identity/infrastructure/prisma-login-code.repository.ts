/**
 * Prisma adapter for `LoginCodeRepository`. The atomic consume uses
 * the same `updateMany({ where: { id, consumedAt: null, expiresAt: {
 * gt: now } } })` + count==1 owner-scoped-write pattern as the
 * magic-link repo (ADR-012).
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from '../../../common/db/prisma.service';
import type { LoginChannel, LoginCode } from '../domain/login-code.entity';
import type { LoginCodeRepository } from '../application/ports/login-code.repository';

interface LoginCodeRow {
  id: string;
  channel: string;
  destHash: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function toDomain(row: LoginCodeRow): LoginCode {
  return {
    id: row.id,
    channel: row.channel as LoginChannel,
    destHash: row.destHash,
    codeHash: row.codeHash,
    attempts: row.attempts,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaLoginCodeRepository implements LoginCodeRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(input: {
    readonly channel: LoginChannel;
    readonly destHash: string;
    readonly codeHash: string;
    readonly expiresAt: Date;
  }): Promise<LoginCode> {
    const row = await this.prisma.loginCode.create({
      data: {
        channel: input.channel,
        destHash: input.destHash,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
      },
    });
    return toDomain(row);
  }

  async findActive(destHash: string): Promise<LoginCode | null> {
    const row = await this.prisma.loginCode.findFirst({
      where: { destHash, consumedAt: null, expiresAt: { gt: this.clock.now() } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async registerFailedAttempt(id: string): Promise<number> {
    const row = await this.prisma.loginCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return row.attempts;
  }

  async consume(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.loginCode.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }

  async countRecent(destHash: string, withinMs: number): Promise<number> {
    const since = new Date(this.clock.nowMs() - withinMs);
    return this.prisma.loginCode.count({
      where: { destHash, createdAt: { gte: since } },
    });
  }
}
