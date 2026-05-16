/**
 * POST.2A.2 — Prisma adapter for TripWatchRepository.
 *
 * `findActiveByTrip` backs the one-active-watch-per-trip invariant
 * enforced in StartTripWatchUseCase. Maps Prisma rows → domain
 * entities via a local `toDomain` helper.
 *
 * Installed by prompt [POST.2A.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TripWatch as PrismaTripWatch } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { SignalKind, TripWatch } from '../domain/trip-watch.entity';
import type {
  CreateTripWatchInput,
  TripWatchRepository,
} from '../application/ports/trip-watch.repository';

function toDomain(row: PrismaTripWatch): TripWatch {
  return {
    id: row.id,
    tripId: row.tripId,
    agentRunId: row.agentRunId,
    subscribedSignals: row.subscribedSignals as readonly SignalKind[],
    thresholds:
      row.thresholds === null || row.thresholds === undefined
        ? {}
        : (row.thresholds as Readonly<Record<string, number>>),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaTripWatchRepository implements TripWatchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateTripWatchInput): Promise<TripWatch> {
    const row = await this.prisma.tripWatch.create({
      data: {
        tripId: input.tripId,
        agentRunId: input.agentRunId,
        subscribedSignals: [...input.subscribedSignals],
        thresholds: input.thresholds as Prisma.InputJsonValue,
        active: true,
      },
    });
    return toDomain(row);
  }

  async findActiveByTrip(tripId: string): Promise<TripWatch | null> {
    const row = await this.prisma.tripWatch.findFirst({
      where: { tripId, active: true },
    });
    return row ? toDomain(row) : null;
  }

  async listActive(): Promise<readonly TripWatch[]> {
    const rows = await this.prisma.tripWatch.findMany({ where: { active: true } });
    return rows.map(toDomain);
  }

  async raiseThreshold(tripId: string): Promise<void> {
    const row = await this.prisma.tripWatch.findFirst({ where: { tripId, active: true } });
    if (!row || row.thresholds === null || row.thresholds === undefined) return;
    const current = row.thresholds as Record<string, number>;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(current)) {
      next[k] = Math.min(0.95, v + 0.1);
    }
    await this.prisma.tripWatch.update({
      where: { id: row.id },
      data: { thresholds: next as Prisma.InputJsonValue },
    });
  }
}
