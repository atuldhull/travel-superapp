/**
 * /events — live events feed.
 *
 * Closes C0's `events` 0% gap. The api has had `POST /api/v1/events/search`
 * since [V.UX.16] (festival-overlay on trip pages); this page is the
 * standalone surface that uses the same backend with a geolocation
 * prompt + date window + filters.
 *
 * Auth-gated: silent-refresh boot → /login if no token.
 *
 * Installed by [S-Ce] of the S-series real-functionality closeout;
 * restyled into the v2 ("Fusion") design language (royal/gold tokens).
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, MapPin, Search, Ticket } from 'lucide-react';
import {
  useEventsControllerSearch,
  type EventListingDto,
  type SearchEventsRequestDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

// Fallback center if the user denies geolocation — Times Square, NYC.
// Picked because it always has events in the search window, so the
// page demos meaningfully even without permissions.
const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 };

// Shared field styling so every filter input reads as one set.
const FIELD =
  'rounded-lg border border-gold-600/25 bg-surface px-2 py-1 text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

const CATEGORIES: readonly string[] = [
  '',
  'music',
  'food',
  'arts',
  'sports',
  'family',
  'community',
  'tech',
];

export default function EventsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'pending' | 'granted' | 'denied' | 'unavailable'
  >('idle');
  const [radiusKm, setRadiusKm] = useState(50);
  const [category, setCategory] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [dayWindow, setDayWindow] = useState(14);
  const [results, setResults] = useState<readonly EventListingDto[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/events');
  }, [bootComplete, token, router]);

  const search = useEventsControllerSearch({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as { events?: readonly EventListingDto[] };
        setResults(body?.events ?? []);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not search events.'}`,
        );
      },
    },
  });

  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function runSearch() {
    setErrorMsg(null);
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + dayWindow * 86_400_000).toISOString();
    const data: SearchEventsRequestDto = {
      center: { lat: center.lat, lng: center.lng },
      radiusKm,
      from,
      to,
      ...(category ? { category } : {}),
      ...(freeOnly ? { freeOnly: true } : {}),
    };
    search.mutate({ data });
  }

  // Trigger an initial search after boot when we have a token.
  useEffect(() => {
    if (bootComplete && token !== null && results === null && !search.isPending) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token]);

  const sorted = useMemo(
    () =>
      results
        ? [...results].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          )
        : null,
    [results],
  );

  if (!bootComplete)
    return (
      <main>
        <p className="text-muted">Restoring session…</p>
      </main>
    );
  if (token === null)
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Ticket aria-hidden className="h-3.5 w-3.5" /> What’s on
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Events near you
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Concerts, festivals, food fairs, talks — pulled from open providers. “Free only” filters
          to $0 events for the budget-backpacker view.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Filters</CardTitle>
          <CardSubtitle>
            Centered at {center.lat.toFixed(3)}, {center.lng.toFixed(3)} · {radiusKm} km · next{' '}
            {dayWindow} days
            {geoStatus === 'pending' ? ' · locating…' : ''}
            {geoStatus === 'denied' ? ' · using default location (NYC)' : ''}
          </CardSubtitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={requestGeolocation}>
              <MapPin aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              {geoStatus === 'granted' ? 'Re-locate' : 'Use my location'}
            </Button>
            <label className="text-xs text-muted">
              Radius (km)
              <input
                type="number"
                min={1}
                max={500}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className={`ml-2 w-20 ${FIELD}`}
              />
            </label>
            <label className="text-xs text-muted">
              Window (days)
              <input
                type="number"
                min={1}
                max={90}
                value={dayWindow}
                onChange={(e) => setDayWindow(Number(e.target.value))}
                className={`ml-2 w-20 ${FIELD}`}
              />
            </label>
            <label className="text-xs text-muted">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`ml-2 ${FIELD}`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c || 'any'} value={c}>
                    {c || 'any'}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="accent-gold-600"
              />
              free only
            </label>
            <Button
              type="button"
              variant="royal"
              size="sm"
              onClick={runSearch}
              disabled={search.isPending}
            >
              <Search aria-hidden className="mr-1.5 h-4 w-4" />
              {search.isPending ? 'Searching…' : 'Search events'}
            </Button>
          </div>
        </div>
      </Card>

      {errorMsg ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </p>
      ) : null}

      {search.isPending && sorted === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" count={4} />
        </div>
      ) : sorted === null ? null : sorted.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">
            No events found in the window. Widen the radius, try a longer window, or clear the
            category.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sorted.map((ev) => (
            <li key={`${ev.provider}:${ev.externalId}`}>
              <EventRow event={ev} />
            </li>
          ))}
        </ul>
      )}

      <footer className="flex items-center gap-1.5 text-xs text-muted">
        <CalendarDays aria-hidden className="h-3.5 w-3.5" /> Want events on your trip page? They
        overlay automatically per day on{' '}
        <Link href="/trips" className="text-gold-600 underline-offset-2 hover:underline">
          your trips
        </Link>
        .
      </footer>
    </main>
  );
}

function EventRow({ event: ev }: { event: EventListingDto }) {
  const starts = new Date(ev.startsAt);
  const dateStr = starts.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = starts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const distanceKm = (ev.distanceMeters / 1000).toFixed(1);
  const isFree = ev.priceMin === null || ev.priceMin === ('0' as unknown as typeof ev.priceMin);
  const description = ev.description as unknown as string | null;
  const venueName = ev.venueName as unknown as string | null;
  const sourceUrl = ev.sourceUrl as unknown as string | null;
  return (
    <article className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold tracking-tight text-surface-foreground">
            {ev.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {dateStr} · {timeStr}
            {venueName ? ` · ${venueName}` : ''} · {distanceKm} km away
          </p>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={isFree ? 'gold' : 'neutral'}>
            {isFree ? 'Free' : `${ev.currency ?? ''} ${ev.priceMin ?? '?'}`}
          </Badge>
          <Badge variant="neutral">{ev.category}</Badge>
        </div>
      </div>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-gold-600 underline-offset-2 hover:underline"
        >
          Source ↗
        </a>
      ) : null}
    </article>
  );
}
