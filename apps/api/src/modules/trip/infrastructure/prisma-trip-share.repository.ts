/**
 * Prisma adapter for `TripShareRepository`. Direct Prisma delegate
 * calls — no raw SQL needed (TripShare has no PostGIS columns).
 *
 * Installed by prompt [IV.18.2.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripShare as PrismaTripShare } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { TripShare } from '../domain/trip-share.entity';
import type {
  CreateShareInput,
  TripShareRepository,
} from '../application/ports/trip-share.repository';

@Injectable()
export class PrismaTripShareRepository implements TripShareRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
