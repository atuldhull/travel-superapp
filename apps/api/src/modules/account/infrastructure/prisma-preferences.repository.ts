/**
 * Prisma adapter for PreferencesRepository (V.UX.14). No PostGIS,
 * no vectors — direct delegate.
 *
 * Installed by prompt [V.UX.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Preferences as PrismaPreferences } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Preferences } from '../domain/preferences.entity';
import type {
  PreferencesRepository,
  UpsertPreferencesInput,
} from '../application/ports/preferences.repository';

@Injectable()
export class PrismaPreferencesRepository implements PreferencesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrDefault(userId: string): Promise<Preferences> {
    const row = await this.prisma.preferences.findUnique({ where: { userId } });
    if (row) return toDomain(row);
    // Synthetic default shape — same column defaults the migration
    // sets. Caller never sees an empty body even before first write.
    const now = new Date();
    return {
      id: '',
      userId,
      diet: [],
      accessibility: [],
      travelType: [],
      budgetTier: 2,
      familyMode: false,
      kidAges: [],
      comfortMode: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async upsert(input: UpsertPreferencesInput): Promise<Preferences> {
    // Only build the data fields actually present in the patch so an
    // `undefined` doesn't accidentally clobber a column to default.
    const updateData: Record<string, unknown> = {};
    if (input.diet !== undefined) updateData['diet'] = [...input.diet];
    if (input.accessibility !== undefined) updateData['accessibility'] = [...input.accessibility];
    if (input.travelType !== undefined) updateData['travelType'] = [...input.travelType];
    if (input.budgetTier !== undefined) updateData['budgetTier'] = input.budgetTier;
    if (input.familyMode !== undefined) updateData['familyMode'] = input.familyMode;
    if (input.kidAges !== undefined) updateData['kidAges'] = [...input.kidAges];
    if (input.comfortMode !== undefined) updateData['comfortMode'] = input.comfortMode;

    const row = await this.prisma.preferences.upsert({
      where: { userId: input.userId },
      update: updateData,
      create: {
        userId: input.userId,
        diet: input.diet ? [...input.diet] : [],
        accessibility: input.accessibility ? [...input.accessibility] : [],
        travelType: input.travelType ? [...input.travelType] : [],
        budgetTier: input.budgetTier ?? 2,
        familyMode: input.familyMode ?? false,
        kidAges: input.kidAges ? [...input.kidAges] : [],
        comfortMode: input.comfortMode ?? false,
      },
    });
    return toDomain(row);
  }
}

function toDomain(row: PrismaPreferences): Preferences {
  return {
    id: row.id,
    userId: row.userId,
    diet: row.diet,
    accessibility: row.accessibility,
    travelType: row.travelType,
    budgetTier: row.budgetTier,
    familyMode: row.familyMode,
    kidAges: row.kidAges,
    comfortMode: row.comfortMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
