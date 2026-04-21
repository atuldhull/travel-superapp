/**
 * Prisma adapter for `ItineraryRepository`. `replaceDays` runs the
 * delete + bulk-insert pair inside `$transaction` to keep the
 * "re-plan" atomic (CLAUDE rule 13 preserved — only DB writes in
 * the transaction, no network).
 *
 * Installed by prompt [IV.18.2.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ItineraryDay as PrismaDay, ItineraryItem as PrismaItem } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { ItineraryDay, ItineraryItem } from '../domain/itinerary.entity';
import type {
  CreateDayInput,
  ItineraryRepository,
} from '../application/ports/itinerary.repository';

@Injectable()
export class PrismaItineraryRepository implements ItineraryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceDays(
    tripId: string,
    days: readonly CreateDayInput[],
  ): Promise<readonly ItineraryDay[]> {
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.itineraryDay.deleteMany({ where: { tripId } });
      if (days.length === 0) return [];
      await tx.itineraryDay.createMany({
        data: days.map((d) => ({
          tripId,
          dayIndex: d.dayIndex,
          date: d.date,
          summary: d.summary ?? null,
        })),
      });
      return tx.itineraryDay.findMany({
        where: { tripId },
        orderBy: { dayIndex: 'asc' },
      });
    });
    return rows.map(toDayDomain);
  }

  async listDays(tripId: string): Promise<readonly ItineraryDay[]> {
    const rows = await this.prisma.itineraryDay.findMany({
      where: { tripId },
      orderBy: { dayIndex: 'asc' },
    });
    return rows.map(toDayDomain);
  }

  async clearAll(tripId: string): Promise<void> {
    await this.prisma.itineraryDay.deleteMany({ where: { tripId } });
  }

  async listItemsForDay(dayId: string): Promise<readonly ItineraryItem[]> {
    const rows = await this.prisma.itineraryItem.findMany({
      where: { dayId },
      orderBy: { position: 'asc' },
    });
    return rows.map(toItemDomain);
  }
}

function toDayDomain(row: PrismaDay): ItineraryDay {
  return {
    id: row.id,
    tripId: row.tripId,
    dayIndex: row.dayIndex,
    date: row.date,
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItemDomain(row: PrismaItem): ItineraryItem {
  return {
    id: row.id,
    dayId: row.dayId,
    position: row.position,
    placeId: row.placeId,
    startTime: row.startTime,
    endTime: row.endTime,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
