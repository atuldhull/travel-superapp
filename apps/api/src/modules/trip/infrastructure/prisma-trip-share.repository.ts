/**
 * Prisma adapter for `TripShareRepository`. Direct Prisma delegate
 * calls — no raw SQL needed (TripShare has no PostGIS columns).
 *
 * Installed by prompt [IV.18.2.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import type { TripShare as PrismaTripShare } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { TripShare } from '../domain/trip-share.entity';
import type {
  CreateShareInput,
  TripShareRepository,
} from '../application/ports/trip-share.repository';

@Injectable()
export class PrismaTripShareRepository implements TripShareRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(input: CreateShareInput): Promise<TripShare> {
    const row = await this.prisma.tripShare.create({
      data: {
        tripId: input.tripId,
        ownerId: input.ownerId,
        shareCode: input.shareCode,
        publicRead: true,
        expiresAt: input.expiresAt,
      },
    });
    return toDomain(row);
  }

  async findByCode(code: string): Promise<TripShare | null> {
    const row = await this.prisma.tripShare.findUnique({ where: { shareCode: code } });
    return row ? toDomain(row) : null;
  }

  async revokeByCodeForOwner(code: string, ownerId: string): Promise<boolean> {
    // `updateMany` returns count — atomic "flip only if owned". A
    // non-owner hitting the same code gets count=0 (no leak about
    // ownership) and the use-case maps that to 404.
    const result = await this.prisma.tripShare.updateMany({
      where: { shareCode: code, ownerId, publicRead: true },
      data: { publicRead: false },
    });
    return result.count === 1;
  }

  async listByTripForOwner(tripId: string, ownerId: string): Promise<readonly TripShare[]> {
    const rows = await this.prisma.tripShare.findMany({
      where: { tripId, ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async countActiveSharesForTrip(tripId: string): Promise<number> {
    // Active = publicRead=true AND (no expiry OR expiry > now).
    // Prisma's OR filter handles the nullable expiry cleanly.
    const now = this.clock.now();
    return this.prisma.tripShare.count({
      where: {
        tripId,
        publicRead: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }
}

function toDomain(row: PrismaTripShare): TripShare {
  return {
    id: row.id,
    tripId: row.tripId,
    ownerId: row.ownerId,
    shareCode: row.shareCode,
    publicRead: row.publicRead,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}
