/**
 * V.UX.31 — Prisma adapter for `PasswordResetTokenRepository`.
 * Same `updateMany + count` atomic-consume pattern as
 * `PrismaMagicLinkTokenRepository`.
 *
 * Installed by prompt [V.UX.31].
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { PasswordResetToken } from '../domain/password-reset-token.entity';
import type { PasswordResetTokenRepository } from '../application/ports/password-reset-token.repository';

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    readonly emailHash: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        emailHash: input.emailHash,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async consume(tokenHash: string, now: Date): Promise<PasswordResetToken | null> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return row;
  }

  async countRecentForEmail(emailHash: string, withinMs: number): Promise<number> {
    const since = new Date(Date.now() - withinMs);
    return this.prisma.passwordResetToken.count({
      where: { emailHash, createdAt: { gte: since } },
    });
  }
}
