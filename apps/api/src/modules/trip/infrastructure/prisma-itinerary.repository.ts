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
  CreateItemInput,
  ItineraryRepository,
} from '../application/ports/itinerary.repository';

type PrismaDayWithItems = PrismaDay & { items: PrismaItem[] };

@Injectable()
export class PrismaItineraryRepository implements ItineraryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceDays(
    tripId: string,
    days: readonly CreateDayInput[],
  ): Promise<readonly ItineraryDay[]> {
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.itineraryDay.deleteMany({ where: { tripId } });
      if (days.length === 0) return [] as PrismaDayWithItems[];
      // Insert days individually so we can reuse the generated day id
      // when inserting child items in the same tx. A bulk createMany
      // would be cheaper but wouldn't return the ids.
      for (const d of days) {
        const day = await tx.itineraryDay.create({
          data: {
            tripId,
            dayIndex: d.dayIndex,
            date: d.date,
            summary: d.summary ?? null,
          },
        });
        if (d.items && d.items.length > 0) {
          await tx.itineraryItem.createMany({
            data: d.items.map((it) => ({
              dayId: day.id,
              position: it.position,
              placeId: it.placeId,
              notes: it.notes ?? null,
              startTime: it.startTime ?? null,
              endTime: it.endTime ?? null,
            })),
          });
        }
      }
      return tx.itineraryDay.findMany({
        where: { tripId },
        orderBy: { dayIndex: 'asc' },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
    return rows.map(toDayDomain);
  }

  async listDays(tripId: string): Promise<readonly ItineraryDay[]> {
    const rows = await this.prisma.itineraryDay.findMany({
      where: { tripId },
      orderBy: { dayIndex: 'asc' },
      include: { items: { orderBy: { position: 'asc' } } },
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

  async findDayForUser(dayId: string, userId: string): Promise<ItineraryDay | null> {
    // Scoped lookup via the Trip FK — a day belongs to a Trip
    // belongs to a User. Prevents horizontal IDOR.
    const row = await this.prisma.itineraryDay.findFirst({
      where: { id: dayId, trip: { userId } },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return row ? toDayDomain(row) : null;
  }

  async findDayById(dayId: string): Promise<ItineraryDay | null> {
    // Unscoped lookup — caller is responsible for running an
    // access gate first. Used by `[IV.18.2.14]` co-edit path.
    const row = await this.prisma.itineraryDay.findUnique({
      where: { id: dayId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return row ? toDayDomain(row) : null;
  }

  async replaceItemsForDay(
    dayId: string,
    items: readonly CreateItemInput[],
  ): Promise<ItineraryDay> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.itineraryItem.deleteMany({ where: { dayId } });
      if (items.length > 0) {
        await tx.itineraryItem.createMany({
          data: items.map((it) => ({
            dayId,
            position: it.position,
            placeId: it.placeId,
            notes: it.notes ?? null,
            startTime: it.startTime ?? null,
            endTime: it.endTime ?? null,
          })),
        });
      }
      return tx.itineraryDay.findUniqueOrThrow({
        where: { id: dayId },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
    return toDayDomain(row);
  }
}

function toDayDomain(row: PrismaDayWithItems): ItineraryDay {
  return {
    id: row.id,
    tripId: row.tripId,
    dayIndex: row.dayIndex,
    date: row.date,
    summary: row.summary,
    items: row.items.map(toItemDomain),
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
