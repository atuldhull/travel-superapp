/**
 * V.UX.14 — caller-self user preferences. Mirrors the Prisma row.
 * Fields land via upsert (one row per user, unique on `userId`).
 *
 * `familyMode` flips the search forms into family-aware mode:
 * filter chips auto-add `kid_friendly`, `stroller_accessible`,
 * `high_chair`, `crib`, and the trip detail page surfaces a
 * pacing warning when a day has > 4 items.
 *
 * `kidAges` is a flat int[] (0..17) so age-aware copy ("3 kids
 * aged 5, 7, 10") doesn't need a join.
 *
 * The other fields (diet/accessibility/travelType/budgetTier) are
 * carried-over from the original schema — they're surfaced here
 * so the same /account/preferences endpoint covers them too,
 * avoiding two parallel preferences surfaces.
 *
 * Installed by prompt [V.UX.14].
 */
export interface Preferences {
  readonly id: string;
  readonly userId: string;
  readonly diet: readonly string[];
  readonly accessibility: readonly string[];
  readonly travelType: readonly string[];
  readonly budgetTier: number;
  readonly familyMode: boolean;
  readonly kidAges: readonly number[];
  /**
   * V.UX.15 — accessibility / senior persona. When true the web
   * applies a `.comfort` class on `<html>` (larger fonts +
   * tap targets) and transport searches default `stepFreeOnly: true`.
   */
  readonly comfortMode: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
