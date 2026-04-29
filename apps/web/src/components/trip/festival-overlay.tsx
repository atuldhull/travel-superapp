/**
 * V.UX.22 — festival overlay for the cultural / religious traveler.
 *
 * Fetches `GET /events/festivals` once for the trip's date range
 * using browser geolocation as the centre, then surfaces a tiny
 * helper hook (`useFestivalsByDate`) that returns a `Map<isoDate,
 * EventListing[]>` so the day-card renderer can stamp a "🎉 X today"
 * banner without re-fetching per day.
 *
 * Why geolocation rather than the trip centre: the trip's PostGIS
 * `center` isn't on TripDto today (lat/lng is `Unsupported` for
 * Prisma). Geolocation is good enough for a presentation overlay —
 * a real "festivals near my trip" surface lands when the trip
 * detail endpoint surfaces center coordinates.
 *
 * Installed by prompt [V.UX.22].
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type FestivalsDuringResponseDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

interface FestivalEntry {
  readonly externalId: string;
  readonly title: string;
  readonly venueName: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
}

function isoDayKey(d: Date): string {
  // Use the local-day ISO key to match what `new Date(day.date).toLocaleDateString()`
  // would resolve to. Avoids a UTC vs local off-by-one when the day card's
  // `day.date` is a midnight-UTC timestamp.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Hook returning a per-local-day map of festivals. Empty map until
 * geolocation + the trip's date range are both known. Only enabled
 * when the user is signed in.
 */
export function useFestivalsByDate(opts: {
  readonly fromIso: string | null;
  readonly toIso: string | null;
}): {
  readonly festivalsByDate: ReadonlyMap<string, readonly FestivalEntry[]>;
  readonly isLoading: boolean;
} {
  const token = useAuthToken();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (token === null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // No-op — the overlay just stays absent. Other widgets on
        // the page own the user-facing geo error message.
      },
      { timeout: 8_000, enableHighAccuracy: false },
    );
  }, [token]);

  // Orval skipped query-param generation for the festivals route's
  // ApiQuery decorators in some configurations; call apiFetch
  // directly so the contract is unambiguous.
  type Envelope = { data: FestivalsDuringResponseDto; status: number; headers: Headers };
  const enabled = token !== null && coords !== null && opts.fromIso !== null && opts.toIso !== null;
  const query = useQuery<Envelope>({
    queryKey: ['events/festivals', coords?.lat, coords?.lng, opts.fromIso, opts.toIso],
    queryFn: () =>
      apiFetch<Envelope>(
        `/api/v1/events/festivals?lat=${coords!.lat}&lng=${coords!.lng}&from=${encodeURIComponent(
          opts.fromIso!,
        )}&to=${encodeURIComponent(opts.toIso!)}`,
        { method: 'GET' },
      ),
    enabled,
    retry: false,
  });

  const festivalsByDate = useMemo(() => {
    const out = new Map<string, FestivalEntry[]>();
    const list = query.data?.data?.festivals;
    if (!list) return out;
    for (const f of list as readonly FestivalEntry[]) {
      const start = new Date(f.startsAt);
      const end = new Date(f.endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      // Stamp the festival on every local day the window touches so
      // a multi-day Diwali shows up across all of its days.
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor.getTime() <= lastDay.getTime()) {
        const key = isoDayKey(cursor);
        const bucket = out.get(key) ?? [];
        bucket.push(f);
        out.set(key, bucket);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return out;
  }, [query.data]);

  return { festivalsByDate, isLoading: query.isLoading };
}

/**
 * Per-day banner. Caller passes the day's date (any parseable form)
 * + the map from `useFestivalsByDate`. Renders nothing if no
 * festivals match.
 */
export function DayFestivalBanner({
  dayDate,
  festivalsByDate,
}: {
  readonly dayDate: string | Date;
  readonly festivalsByDate: ReadonlyMap<string, readonly FestivalEntry[]>;
}) {
  const d = typeof dayDate === 'string' ? new Date(dayDate) : dayDate;
  if (Number.isNaN(d.getTime())) return null;
  const matches = festivalsByDate.get(isoDayKey(d));
  if (!matches || matches.length === 0) return null;
  return (
    <p className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
      🎉 {matches.map((m) => m.title).join(' · ')} today
    </p>
  );
}
