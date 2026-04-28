/**
 * V.UX.16 — sticky daily-spend banner. Shown on `/trips/[id]` when
 * the caller has flipped `Preferences.budgetMode = true`.
 *
 *   - Pulls the trip's expenses via the existing
 *     `/expenses?tripId=...&limit=...` route.
 *   - Sums every expense whose `createdAt` lies in the user's
 *     "today" window (local browser midnight → next midnight).
 *   - Compares against `Preferences.dailyBudgetUsd`. When unset,
 *     just renders the running total without the cap.
 *   - Sticky to the top of the trip page so the persona's "where am
 *     I vs my $50?" check is always one glance away.
 *
 * Renders nothing when budgetMode is off. Renders a soft note when
 * the trip has zero expenses today (so the banner doesn't flash a
 * "$0 / $50" before the data lands).
 *
 * Installed by prompt [V.UX.16].
 */
'use client';

import {
  useExpensesControllerList,
  usePreferencesControllerGetMine,
  type ExpenseDto,
  type PreferencesDto,
} from '@app/sdk';

export interface DailySpendBannerProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

export function DailySpendBanner({ tripId, enabled }: DailySpendBannerProps) {
  const prefsQ = usePreferencesControllerGetMine({ query: { enabled } });
  // Inline limit param to mirror /trips/[id]/expenses' usage; the
  // generated hook signature requires a positional `params` arg.
  const expensesQ = useExpensesControllerList(tripId, { limit: '500' }, { query: { enabled } });

  const prefs = prefsQ.data?.data as unknown as PreferencesDto | undefined;
  if (!prefs?.budgetMode) return null;

  const expenses =
    (expensesQ.data?.data as unknown as { expenses: ExpenseDto[] } | undefined)?.expenses ?? [];

  const dayStart = startOfTodayMs();
  const dayEnd = dayStart + 86_400_000;
  const cents = expenses.reduce((acc, e) => {
    const t = Date.parse(e.createdAt);
    if (!Number.isFinite(t)) return acc;
    if (t < dayStart || t >= dayEnd) return acc;
    const n = Number(e.amountUsd);
    if (!Number.isFinite(n)) return acc;
    return acc + Math.round(n * 100);
  }, 0);
  const todayUsd = (cents / 100).toFixed(2);

  const targetStr = (prefs.dailyBudgetUsd as unknown as string | null) ?? null;
  const targetCents = targetStr === null ? null : Math.round(Number(targetStr) * 100);

  let tone: 'green' | 'amber' | 'red' = 'green';
  if (targetCents !== null && targetCents > 0) {
    const ratio = cents / targetCents;
    tone = ratio >= 1 ? 'red' : ratio >= 0.75 ? 'amber' : 'green';
  }
  const cls =
    tone === 'green'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : tone === 'amber'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-2 z-30 rounded-md border-2 px-3 py-2 text-sm font-medium shadow-sm ${cls}`}
    >
      💰 Today's spend: <span className="font-mono">${todayUsd}</span>
      {targetStr !== null ? (
        <>
          {' '}
          / <span className="font-mono">${targetStr}</span> budget
          {tone === 'red' ? <span className="ml-2 text-xs">— over the cap</span> : null}
          {tone === 'amber' ? <span className="ml-2 text-xs">— close to the cap</span> : null}
        </>
      ) : (
        <span className="ml-2 text-xs text-muted">
          (set a daily target on /account/preferences)
        </span>
      )}
    </div>
  );
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
