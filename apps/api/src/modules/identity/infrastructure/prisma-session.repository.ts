/**
 * Prisma adapter for `SessionRepository`. Thin — maps rows to the
 * domain `Session` shape and back.
 *
 * `rotate()` uses a Prisma transaction to keep the "revoke old +
 * insert new" pair atomic (CLAUDE rule 13 still holds — no network
 * calls inside the transaction, only DB writes).
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Session as PrismaSession } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Session } from '../domain/session.entity';
import type {
  CreateSessionInput,
  SessionRepository,
} from '../application/ports/session.repository';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const row = await this.prisma.session.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenH: input.refreshTokenHash,
        deviceId: input.deviceId,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        expiresAt: input.expiresAt,
      },
    });
    return toDomain(row);
  }

  async findByRefreshHash(refreshTokenHash: string): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({
      where: { refreshTokenH: refreshTokenHash },
    });
    return row ? toDomain(row) : null;
  }

  async rotate(oldSessionId: string, next: CreateSessionInput): Promise<Session> {
    const newRow = await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: oldSessionId },
        data: { revokedAt: new Date() },
      });
      return tx.session.create({
        data: {
          id: next.id,
          userId: next.userId,
          refreshTokenH: next.refreshTokenHash,
          deviceId: next.deviceId,
          userAgent: next.userAgent,
          ipHash: next.ipHash,
          expiresAt: next.expiresAt,
        },
      });
    });
    return toDomain(newRow);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count;
  }
}

function toDomain(row: PrismaSession): Session {
  return {
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenH,
    deviceId: row.deviceId,
    userAgent: row.userAgent,
    ipHash: row.ipHash,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
