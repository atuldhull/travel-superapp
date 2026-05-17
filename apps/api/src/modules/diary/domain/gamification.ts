/**
 * Pure gamification rules for the Adventure Diary — points, streaks,
 * and the badge catalog. No I/O, fully deterministic, unit-testable
 * in isolation (clean/hex: this is the domain core the use-case
 * orchestrates).
 *
 * Points per entry:
 *   base 50  ·  +20 substantial (body ≥ 280 chars)  ·  +15 AI-assisted
 *   ·  +10 linked to a trip  ·  streak bonus = min(streak,10) × 5
 *
 * Streak counts DISTINCT adventure days (entryDate, date-only):
 *   same day → unchanged · next day → +1 · gap ≥ 2 → reset to 1 ·
 *   backdated older than last → unchanged (we never move the streak
 *   anchor backwards).
 *
 * Installed for the adventure-diary feature (user-directed).
 */

export interface GamificationState {
  readonly totalPoints: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly entryCount: number;
  readonly aiAssistCount: number;
  readonly lastEntryOn: Date | null;
}

export interface EntryFacts {
  readonly entryDate: Date;
  readonly bodyLength: number;
  readonly aiAssisted: boolean;
  readonly hasTrip: boolean;
}

export interface AwardResult {
  readonly pointsAwarded: number;
  readonly next: GamificationState;
  readonly newlyEarnedBadges: readonly string[];
}

export interface BadgeDef {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** lucide-react icon name the web maps 1:1. */
  readonly icon: string;
}

/** Ordered display catalog. New badges land here — never in the DB. */
export const BADGE_CATALOG: readonly BadgeDef[] = [
  {
    key: 'first_steps',
    name: 'First Steps',
    description: 'Wrote your first diary entry.',
    icon: 'Footprints',
  },
  { key: 'chronicler', name: 'Chronicler', description: 'Logged 10 adventures.', icon: 'BookText' },
  { key: 'archivist', name: 'Archivist', description: 'Logged 50 adventures.', icon: 'Library' },
  { key: 'pathfinder', name: 'Pathfinder', description: '3-day writing streak.', icon: 'Compass' },
  { key: 'trailblazer', name: 'Trailblazer', description: '7-day writing streak.', icon: 'Flame' },
  { key: 'odyssey', name: 'Odyssey', description: '30-day writing streak.', icon: 'Crown' },
  {
    key: 'co_author',
    name: 'Co-Author',
    description: 'Used the AI assistant 5 times.',
    icon: 'Sparkles',
  },
  { key: 'point_hoard', name: 'Treasure Hoard', description: 'Banked 1,000 points.', icon: 'Gem' },
];

const POINTS = { base: 50, substantial: 20, aiAssisted: 15, hasTrip: 10 } as const;
const SUBSTANTIAL_CHARS = 280;
const STREAK_BONUS_CAP = 10;

/** UTC midnight of a date — gives stable date-only comparisons
 *  regardless of the time component. */
export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** The single source of truth for "what this entry earns". */
export function applyEntry(
  state: GamificationState,
  facts: EntryFacts,
  alreadyEarned: ReadonlySet<string>,
): AwardResult {
  const today = dateOnly(facts.entryDate);
  const last = state.lastEntryOn ? dateOnly(state.lastEntryOn) : null;

  let currentStreak: number;
  let lastEntryOn: Date;
  if (last === null) {
    currentStreak = 1;
    lastEntryOn = today;
  } else {
    const delta = diffDays(today, last);
    if (delta === 0) {
      currentStreak = Math.max(state.currentStreak, 1);
      lastEntryOn = last;
    } else if (delta === 1) {
      currentStreak = state.currentStreak + 1;
      lastEntryOn = today;
    } else if (delta >= 2) {
      currentStreak = 1;
      lastEntryOn = today;
    } else {
      // Backdated older than the anchor — keep streak + anchor.
      currentStreak = Math.max(state.currentStreak, 1);
      lastEntryOn = last;
    }
  }

  const longestStreak = Math.max(state.longestStreak, currentStreak);

  let pointsAwarded = POINTS.base;
  if (facts.bodyLength >= SUBSTANTIAL_CHARS) pointsAwarded += POINTS.substantial;
  if (facts.aiAssisted) pointsAwarded += POINTS.aiAssisted;
  if (facts.hasTrip) pointsAwarded += POINTS.hasTrip;
  pointsAwarded += Math.min(currentStreak, STREAK_BONUS_CAP) * 5;

  const next: GamificationState = {
    totalPoints: state.totalPoints + pointsAwarded,
    currentStreak,
    longestStreak,
    entryCount: state.entryCount + 1,
    aiAssistCount: state.aiAssistCount + (facts.aiAssisted ? 1 : 0),
    lastEntryOn,
  };

  const earned = (k: string): boolean => !alreadyEarned.has(k);
  const newlyEarnedBadges: string[] = [];
  if (next.entryCount >= 1 && earned('first_steps')) newlyEarnedBadges.push('first_steps');
  if (next.entryCount >= 10 && earned('chronicler')) newlyEarnedBadges.push('chronicler');
  if (next.entryCount >= 50 && earned('archivist')) newlyEarnedBadges.push('archivist');
  if (next.currentStreak >= 3 && earned('pathfinder')) newlyEarnedBadges.push('pathfinder');
  if (next.currentStreak >= 7 && earned('trailblazer')) newlyEarnedBadges.push('trailblazer');
  if (next.currentStreak >= 30 && earned('odyssey')) newlyEarnedBadges.push('odyssey');
  if (next.aiAssistCount >= 5 && earned('co_author')) newlyEarnedBadges.push('co_author');
  if (next.totalPoints >= 1000 && earned('point_hoard')) newlyEarnedBadges.push('point_hoard');

  return { pointsAwarded, next, newlyEarnedBadges };
}

export const EMPTY_STATE: GamificationState = {
  totalPoints: 0,
  currentStreak: 0,
  longestStreak: 0,
  entryCount: 0,
  aiAssistCount: 0,
  lastEntryOn: null,
};
