/**
 * V.UX.14 — pacing warning surfaced on the trip detail page when
 * the caller has `Preferences.familyMode = true` and any day in
 * the itinerary has > 4 items. The warning is purely advisory
 * (no mutation); the family persona's pain point is "too many
 * stops in one day", so we surface it inline rather than block
 * the save.
 *
 * Reads its own data from the SDK — `/trips/[id]/page.tsx` just
 * mounts it once with the trip id.
 *
 * Installed by prompt [V.UX.14].
 */
'use client';

import {
  usePreferencesControllerGetMine,
  useTripControllerGetItinerary,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type PreferencesDto,
} from '@app/sdk';

const HEAVY_DAY_THRESHOLD = 4;

export interface PacingWarningProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

export function PacingWarning({ tripId, enabled }: PacingWarningProps) {
  const prefsQ = usePreferencesControllerGetMine({ query: { enabled } });
  const itineraryQ = useTripControllerGetItinerary(tripId, { query: { enabled } });

  const prefs = prefsQ.data?.data as unknown as PreferencesDto | undefined;
  const itinerary = itineraryQ.data?.data as unknown as ItineraryListResponseDto | undefined;

  if (!prefs?.familyMode) return null;
  const days: readonly ItineraryDayDto[] = itinerary?.days ?? [];
  const heavy = days.filter((d) => d.items.length > HEAVY_DAY_THRESHOLD);
  if (heavy.length === 0) return null;

  const kids = prefs.kidAges.length;
  const kidLabel = kids === 0 ? 'kids' : kids === 1 ? '1 kid' : `${kids} kids`;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <p className="font-medium">
        ⚠️ Heavy day{heavy.length > 1 ? 's' : ''} for {kidLabel}
      </p>
      <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs">
        {heavy.map((d) => (
          <li key={d.id}>
            Day {d.dayIndex + 1} has {d.items.length} items — {kidLabel} may struggle past{' '}
            {HEAVY_DAY_THRESHOLD}.
          </li>
        ))}
      </ul>
    </div>
  );
}
