/**
 * Prisma adapter for DiaryRepository. Maps rows → domain entities.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { DiaryEntry as PrismaDiaryEntry } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import { DiaryEntry, type NewDiaryEntry } from '../domain/diary-entry.entity';
import type { DiaryRepository, ListDiaryQuery } from '../application/ports/diary.repository';

function toDomain(r: PrismaDiaryEntry): DiaryEntry {
  return DiaryEntry.fromPersistence({
    id: r.id,
    userId: r.userId,
    tripId: r.tripId,
    title: r.title,
    body: r.body,
    mood: r.mood,
    aiAssisted: r.aiAssisted,
    entryDate: r.entryDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });
}

@Injectable()
export class PrismaDiaryRepository implements DiaryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: NewDiaryEntry): Promise<DiaryEntry> {
    const row = await this.prisma.diaryEntry.create({
      data: {
        userId: input.userId,
        tripId: input.tripId ?? null,
        title: input.title,
        body: input.body,
        mood: input.mood ?? null,
        aiAssisted: input.aiAssisted,
        entryDate: input.entryDate,
      },
    });
    return toDomain(row);
  }

  async list(query: ListDiaryQuery): Promise<readonly DiaryEntry[]> {
    const rows = await this.prisma.diaryEntry.findMany({
      where: {
        userId: query.userId,
        ...(query.tripId ? { tripId: query.tripId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
    return rows.map(toDomain);
  }

  async findById(id: string, userId: string): Promise<DiaryEntry | null> {
    const row = await this.prisma.diaryEntry.findFirst({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }
}
