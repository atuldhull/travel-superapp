/**
 * V.UX.14 — partial update of the caller's preferences. Idempotent
 * upsert (creates the row on first write, partial-updates after).
 *
 * Light validation:
 *   - kidAges entries must be 0..17.
 *   - budgetTier 1..5 (matches the existing schema range).
 *   - Up to 8 kids per family (anything more is almost certainly
 *     a fat-finger and would blow up the family-filter copy).
 *
 * Installed by prompt [V.UX.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { Preferences } from '../domain/preferences.entity';
import { PREFERENCES_REPOSITORY, type PreferencesRepository } from './ports/preferences.repository';

const MAX_KIDS = 8;

export interface UpdatePreferencesCommand {
  readonly userId: string;
  readonly diet?: readonly string[];
  readonly accessibility?: readonly string[];
  readonly travelType?: readonly string[];
  readonly budgetTier?: number;
  readonly familyMode?: boolean;
  readonly kidAges?: readonly number[];
  /** V.UX.15 — accessibility / senior comfort-mode toggle. */
  readonly comfortMode?: boolean;
  /** V.UX.16 — budget-backpacker mode toggle. */
  readonly budgetMode?: boolean;
  /** V.UX.16 — daily target USD as a string (or null to clear). */
  readonly dailyBudgetUsd?: string | null;
  /** V.UX.23 — digital-nomad mode toggle. */
  readonly nomadMode?: boolean;
}

@Injectable()
export class UpdatePreferencesUseCase {
  constructor(@Inject(PREFERENCES_REPOSITORY) private readonly repo: PreferencesRepository) {}

  async execute(cmd: UpdatePreferencesCommand): Promise<Preferences> {
    if (cmd.budgetTier !== undefined) {
      if (!Number.isInteger(cmd.budgetTier) || cmd.budgetTier < 1 || cmd.budgetTier > 5) {
        throw new ValidationError(
          'Budget tier must be an integer 1..5',
          { budgetTier: ['1..5'] },
          { budgetTier: cmd.budgetTier },
          'INVALID_BUDGET_TIER',
        );
      }
    }
    if (cmd.kidAges !== undefined) {
      if (cmd.kidAges.length > MAX_KIDS) {
        throw new ValidationError(
          `At most ${MAX_KIDS} kids`,
          { kidAges: [`max ${MAX_KIDS}`] },
          { count: cmd.kidAges.length },
          'TOO_MANY_KIDS',
        );
      }
      for (const a of cmd.kidAges) {
        if (!Number.isInteger(a) || a < 0 || a > 17) {
          throw new ValidationError(
            'Each kid age must be an integer 0..17',
            { kidAges: ['each entry 0..17'] },
            { age: a },
            'INVALID_KID_AGE',
          );
        }
      }
    }

    if (cmd.dailyBudgetUsd !== undefined && cmd.dailyBudgetUsd !== null) {
      const n = Number(cmd.dailyBudgetUsd);
      if (!Number.isFinite(n) || n < 0 || n > 100_000) {
        throw new ValidationError(
          'Daily budget must be a non-negative number ≤ 100000',
          { dailyBudgetUsd: ['0..100000'] },
          { dailyBudgetUsd: cmd.dailyBudgetUsd },
          'INVALID_DAILY_BUDGET',
        );
      }
    }

    return this.repo.upsert({
      userId: cmd.userId,
      ...(cmd.diet !== undefined ? { diet: cmd.diet } : {}),
      ...(cmd.accessibility !== undefined ? { accessibility: cmd.accessibility } : {}),
      ...(cmd.travelType !== undefined ? { travelType: cmd.travelType } : {}),
      ...(cmd.budgetTier !== undefined ? { budgetTier: cmd.budgetTier } : {}),
      ...(cmd.familyMode !== undefined ? { familyMode: cmd.familyMode } : {}),
      ...(cmd.kidAges !== undefined ? { kidAges: cmd.kidAges } : {}),
      ...(cmd.comfortMode !== undefined ? { comfortMode: cmd.comfortMode } : {}),
      ...(cmd.budgetMode !== undefined ? { budgetMode: cmd.budgetMode } : {}),
      ...(cmd.dailyBudgetUsd !== undefined ? { dailyBudgetUsd: cmd.dailyBudgetUsd } : {}),
      ...(cmd.nomadMode !== undefined ? { nomadMode: cmd.nomadMode } : {}),
    });
  }
}
