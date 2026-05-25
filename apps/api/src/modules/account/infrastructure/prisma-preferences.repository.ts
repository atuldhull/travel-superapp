/**
 * Prisma adapter for PreferencesRepository (V.UX.14). No PostGIS,
 * no vectors — direct delegate.
 *
 * Installed by prompt [V.UX.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import type { Preferences as PrismaPreferences } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Preferences } from '../domain/preferences.entity';
import type {
  PreferencesRepository,
  UpsertPreferencesInput,
} from '../application/ports/preferences.repository';

@Injectable()
export class PrismaPreferencesRepository implements PreferencesRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getOrDefault(userId: string): Promise<Preferences> {
    const row = await this.prisma.preferences.findUnique({ where: { userId } });
    if (row) return toDomain(row);
    // Synthetic default shape — same column defaults the migration
    // sets. Caller never sees an empty body even before first write.
    const now = this.clock.now();
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
      budgetMode: false,
      dailyBudgetUsd: null,
      nomadMode: false,
      travelAura: null,
      homeLabel: null,
      homeLat: null,
      homeLng: null,
      travelInterests: [],
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
    if (input.budgetMode !== undefined) updateData['budgetMode'] = input.budgetMode;
    if (input.dailyBudgetUsd !== undefined) updateData['dailyBudgetUsd'] = input.dailyBudgetUsd;
    if (input.nomadMode !== undefined) updateData['nomadMode'] = input.nomadMode;
    if (input.travelAura !== undefined) updateData['travelAura'] = input.travelAura;
    if (input.homeLabel !== undefined) updateData['homeLabel'] = input.homeLabel;
    if (input.homeLat !== undefined) updateData['homeLat'] = input.homeLat;
    if (input.homeLng !== undefined) updateData['homeLng'] = input.homeLng;
    if (input.travelInterests !== undefined)
      updateData['travelInterests'] = [...input.travelInterests];

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
        budgetMode: input.budgetMode ?? false,
        dailyBudgetUsd: input.dailyBudgetUsd ?? null,
        nomadMode: input.nomadMode ?? false,
        travelAura: input.travelAura ?? null,
        homeLabel: input.homeLabel ?? null,
        homeLat: input.homeLat ?? null,
        homeLng: input.homeLng ?? null,
        travelInterests: input.travelInterests ? [...input.travelInterests] : [],
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
    budgetMode: row.budgetMode,
    // Prisma surfaces Decimal as a Decimal.js instance — `.toFixed(2)`
    // gives us the canonical 2-decimal string the rest of the wire
    // uses for money.
    dailyBudgetUsd: row.dailyBudgetUsd === null ? null : row.dailyBudgetUsd.toFixed(2),
    nomadMode: row.nomadMode,
    travelAura: row.travelAura,
    homeLabel: row.homeLabel,
    homeLat: row.homeLat,
    homeLng: row.homeLng,
    travelInterests: row.travelInterests,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
