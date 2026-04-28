/**
 * V.UX.14 — port for user preferences persistence. One row per
 * user; the `getOrDefault` helper lets the read path always
 * return a usable shape (no separate "404 vs first read" branch
 * in the use-case).
 *
 * Installed by prompt [V.UX.14].
 */
import type { Preferences } from '../../domain/preferences.entity';

export interface UpsertPreferencesInput {
  readonly userId: string;
  readonly diet?: readonly string[];
  readonly accessibility?: readonly string[];
  readonly travelType?: readonly string[];
  readonly budgetTier?: number;
  readonly familyMode?: boolean;
  readonly kidAges?: readonly number[];
}

export interface PreferencesRepository {
  /**
   * Returns the row for `userId` if it exists, or a synthetic
   * default-shaped record (no DB write) if it doesn't. The default
   * matches the Prisma column defaults: empty arrays + budget tier
   * 2 + familyMode false. Lets the read endpoint stay consistent
   * before the user has ever written preferences.
   */
  getOrDefault(userId: string): Promise<Preferences>;

  /**
   * Atomic upsert — creates the row on first write, partial-updates
   * thereafter. Only fields present in the patch get touched; an
   * `undefined` value never accidentally clobbers a column.
   */
  upsert(input: UpsertPreferencesInput): Promise<Preferences>;
}

export const PREFERENCES_REPOSITORY = Symbol('PreferencesRepository');
