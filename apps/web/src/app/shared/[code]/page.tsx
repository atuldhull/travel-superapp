/**
 * Public shared-trip viewer — `/shared/:code`. The recipient hits this
 * page with the opaque share code minted by the trip owner; the api
 * route is `@Public()` so no auth is needed. We render the title,
 * dates, and itinerary days+items. Owner userId is never exposed
 * (only `ownerDisplayName`); center coordinates are not in the public
 * DTO so the page intentionally has no map.
 *
 * Installed by prompt [IV.18.19.46].
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useTripControllerGetSharedTrip,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type SharedTripDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function SharedTripPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? '';

  const { data, isLoading, isError, error } = useTripControllerGetSharedTrip(code, {
    query: { enabled: code !== '', retry: false },
  });

  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }

  if (isError) {
    const e = error as ApiError;
    const expired = e.code === 'TRIP_SHARE_EXPIRED' || e.code === 'TRIP_SHARE_NOT_FOUND';
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {expired
            ? 'This share link is no longer valid. Ask the owner for a fresh link.'
            : `Couldn't open this share (${e.code ?? `HTTP_${e.status ?? '???'}`}). ${e.message ?? ''}`}
        </p>
        <p>
          <Link href="/" className="text-sm text-muted hover:underline">
            ← Home
          </Link>
        </p>
      </main>
    );
  }

  const trip = data?.data as unknown as SharedTripDto;
  const days: readonly ItineraryDayDto[] = trip.days ?? [];
  const startsOn = trip.startsOn as unknown as string | null;
  const endsOn = trip.endsOn as unknown as string | null;
  const expiresAt = trip.expiresAt as unknown as string | null;

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Home
        </Link>
      </p>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{trip.title}</CardTitle>
              <CardSubtitle>
                Shared by <strong>{trip.ownerDisplayName}</strong> · Radius {trip.radiusKm}km
              </CardSubtitle>
            </div>
            <Badge variant="brand">Public read</Badge>
          </div>
        </CardHeader>
        <p className="text-sm text-muted">
          {startsOn && endsOn ? (
            <>
              {new Date(startsOn).toLocaleDateString()} → {new Date(endsOn).toLocaleDateString()}
            </>
          ) : (
            'No dates set'
          )}
        </p>
        {expiresAt ? (
          <p className="mt-1 text-xs text-muted">
            Link expires {new Date(expiresAt).toLocaleString()}
          </p>
        ) : null}
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>Itinerary</CardTitle>
            <Badge variant="neutral">{days.length} days</Badge>
          </div>
        </CardHeader>
        {days.length === 0 ? (
          <p className="text-sm text-muted">
            The owner hasn't generated an itinerary yet — only the trip metadata above is shared.
          </p>
        ) : (
          <ol className="space-y-3">
            {days.map((d) => (
              <SharedDayRow key={d.id} day={d} />
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}

function SharedDayRow({ day }: { readonly day: ItineraryDayDto }) {
  const dateStr = new Date(day.date as unknown as string).toLocaleDateString();
  const summary = day.summary as unknown as string | null;
  const items: readonly ItineraryItemDto[] = day.items ?? [];
  return (
    <li className="rounded border border-muted/15 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <strong className="text-sm">Day {day.dayIndex + 1}</strong>
        <span className="text-xs text-muted">{dateStr}</span>
      </div>
      {summary ? <p className="text-xs text-muted">{summary}</p> : null}
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">No items.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {items.map((it) => {
            const notes = it.notes as unknown as string | null;
            return <li key={it.id}>· {notes ?? <em>(no notes)</em>}</li>;
          })}
        </ul>
      )}
    </li>
  );
}
