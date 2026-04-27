/**
 * Public shared-trip viewer — `/shared/:code`. The recipient hits this
 * page with the opaque share code minted by the trip owner; the api
 * route is `@Public()` so no auth is needed. We render the title,
 * dates, and itinerary days+items. Owner userId is never exposed
 * (only `ownerDisplayName`); center coordinates are not in the public
 * DTO so the page intentionally has no map.
 *
 * V.UX.10 enrichments: expiry-countdown banner, "❤️" anonymous
 * counter (rate-limited at the api), "Save to my account" CTA that
 * either bounces an anonymous visitor through `/register?then=clone`
 * or directly clones for an auth'd user. Footer linkback.
 *
 * Installed by prompt [IV.18.19.46]; V.UX.10 polish [V.UX.10].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  useSharedTripReactControllerGetHearts,
  useSharedTripReactControllerHeartTrip,
  useTripControllerCloneShared,
  useTripControllerGetSharedTrip,
  type HeartSharedTripResponseDto,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type SharedTripDto,
  type SharedTripHeartCountResponseDto,
  type TripDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function SharedTripPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const code = params?.code ?? '';
  const [hearted, setHearted] = useState(false);
  const [cloneErr, setCloneErr] = useState<string | null>(null);
  const [heartErr, setHeartErr] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useTripControllerGetSharedTrip(code, {
    query: { enabled: code !== '', retry: false },
  });
  const { data: heartsData } = useSharedTripReactControllerGetHearts(code, {
    query: { enabled: code !== '', retry: false },
  });

  const heartMutation = useSharedTripReactControllerHeartTrip({
    mutation: {
      onSuccess: () => {
        setHearted(true);
        setHeartErr(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        if (e.status === 429) {
          setHeartErr('Wait a minute before hearting again.');
        } else {
          setHeartErr(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Heart failed.'}`);
        }
      },
    },
  });

  const cloneMutation = useTripControllerCloneShared({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const trip = response.data as TripDto;
        router.push(`/trips/${trip.id}`);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setCloneErr(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  // If the user just logged in via /register?then=clone&code=…, run
  // the clone automatically once silent-refresh resolves.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!bootComplete || token === null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('then') !== 'clone') return;
    cloneMutation.mutate({ code });
    // Strip the trigger from the URL so a refresh doesn't re-clone.
    url.searchParams.delete('then');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token, code]);

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
    const expired = e.code === 'SHARE_EXPIRED' || e.code === 'SHARE_NOT_FOUND';
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
  const heartCount =
    (heartMutation.data?.data as unknown as HeartSharedTripResponseDto | undefined)?.hearts ??
    (heartsData?.data as unknown as SharedTripHeartCountResponseDto | undefined)?.hearts ??
    0;

  function onSave() {
    setCloneErr(null);
    if (token === null) {
      // Not signed in → bounce through /register; once back, the
      // useEffect above auto-triggers the clone.
      const next = encodeURIComponent(`/shared/${code}?then=clone`);
      router.push(`/register?next=${next}` as never);
      return;
    }
    cloneMutation.mutate({ code });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Home
        </Link>
      </p>
      {expiresAt ? <ExpiryBanner expiresAt={expiresAt} /> : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onSave} disabled={cloneMutation.isPending}>
            {cloneMutation.isPending ? 'Saving…' : '💾 Save to my account'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => heartMutation.mutate({ code })}
            disabled={heartMutation.isPending}
            aria-pressed={hearted}
          >
            {hearted || heartMutation.isPending ? '❤️' : '🤍'} {heartCount}
          </Button>
          {heartErr ? <span className="text-xs text-muted">{heartErr}</span> : null}
        </div>
        {cloneErr ? (
          <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {cloneErr}
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
      <footer className="pt-4 text-center text-xs text-muted">
        Made in{' '}
        <Link href="/" className="font-semibold text-brand hover:underline">
          TravelSuperApp
        </Link>{' '}
        · Plan your own trip in 30 seconds
      </footer>
    </main>
  );
}

function ExpiryBanner({ expiresAt }: { expiresAt: string }) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const phrase =
    days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`;
  return (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      ⏰ This link expires in <strong>{phrase}</strong>. Save the trip to keep it.
    </p>
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
