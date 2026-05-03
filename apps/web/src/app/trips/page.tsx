/**
 * Protected trips list. Reads `useAuthToken()` — if no token, the user
 * is bounced to `/login`. Otherwise calls the auth-gated `GET /trips`
 * via the generated `useTripControllerList` hook.
 *
 * Empty-state CTA + Sample-trip badge + tour-restart link added in
 * [V.UX.3].
 *
 * The bounce happens client-side because tokens live in memory only
 * (CLAUDE rule 12) — server components can't see the token, so the
 * server can't redirect on the basis of it.
 *
 * Installed by prompt [IV.18.19.21]; V.UX.3 polish [V.UX.3].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTripControllerList, type ListTripsResponseDto, type TripDto } from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { clearAccessToken } from '../../lib/auth-store';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { useShortcut } from '../../lib/use-shortcuts';
import { useVimListNav } from '../../lib/use-vim-list-nav';

export default function TripsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  useEffect(() => {
    // Hold the redirect until silent-refresh has had its chance —
    // otherwise a hard reload always bounces before the httpOnly
    // cookie can resurrect the session.
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useTripControllerList(
    { limit: '20' },
    { query: { enabled: token !== null } },
  );

  // V.UX.29 — vim j/k focus through trip cards + `n` to create.
  const listRef = useRef<HTMLDivElement | null>(null);
  useVimListNav(listRef, { enabled: token !== null });
  useShortcut('n', (e) => {
    e.preventDefault();
    router.push('/trips/new' as never);
  });

  function onLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }

  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }

  const body = data?.data as unknown as ListTripsResponseDto | undefined;
  const trips: readonly TripDto[] = body?.trips ?? [];
  const collaborated: readonly TripDto[] = body?.collaborated ?? [];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your trips</h1>
        <div className="flex gap-2">
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
          >
            New trip
          </Link>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
      {isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card as="li" key={i}>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </Card>
          ))}
        </ul>
      ) : isError ? (
        <ErrorState error={error} />
      ) : trips.length === 0 && collaborated.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={listRef}>
          {trips.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {trips.map((t) => (
                <TripCard key={t.id} trip={t} role="owner" />
              ))}
            </ul>
          ) : null}
          {collaborated.length > 0 ? (
            <section className="mt-6 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Shared with you
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {collaborated.map((t) => (
                  <TripCard key={t.id} trip={t} role="collaborator" />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back home
        </Link>
        {trips.length > 0 ? (
          <Link href="/onboarding?tour=true" className="text-sm text-muted hover:underline">
            ↻ Replay onboarding tour
          </Link>
        ) : null}
      </div>
    </main>
  );
}

/** Title prefix that flags a trip as the read-only sample seeded by
 *  the V.UX.3 onboarding Skip flow. Mirrors
 *  `SAMPLE_TRIP_TITLE_PREFIX` on the api side — kept in sync by hand
 *  since they're a stable contract. */
const SAMPLE_TRIP_PREFIX = 'Sample trip — ';

function isSampleTrip(trip: TripDto): boolean {
  return trip.title.startsWith(SAMPLE_TRIP_PREFIX);
}

function TripCard({ trip, role }: { trip: TripDto; role: 'owner' | 'collaborator' }) {
  const sample = isSampleTrip(trip);
  const statusVariant: 'neutral' | 'brand' = trip.status === 'draft' ? 'neutral' : 'brand';
  return (
    <Card as="li" className={role === 'collaborator' ? 'border-emerald-500/40' : undefined}>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/trips/${trip.id}` as never}
            data-vim-item
            className="rounded outline-none hover:underline focus:ring-2 focus:ring-brand"
          >
            {trip.title}
          </Link>
        </CardTitle>
        <CardSubtitle>
          <Badge variant={statusVariant}>{trip.status}</Badge>
          {role === 'collaborator' ? (
            <>
              {' '}
              · <Badge variant="brand">👥 shared</Badge>
            </>
          ) : null}
          {sample ? (
            <>
              {' '}
              · <Badge variant="neutral">Sample</Badge>
            </>
          ) : null}{' '}
          · Radius {trip.radiusKm}km
        </CardSubtitle>
      </CardHeader>
      {trip.startsOn && trip.endsOn ? (
        <p className="text-sm text-muted">
          {new Date(trip.startsOn as unknown as string).toLocaleDateString()} →{' '}
          {new Date(trip.endsOn as unknown as string).toLocaleDateString()}
        </p>
      ) : (
        <p className="text-sm text-muted">No dates yet</p>
      )}
    </Card>
  );
}

/**
 * Illustrated empty-state for first-time users (and anyone who's
 * deleted all their trips). Big CTA, friendly copy, two paths in.
 *
 * Installed by prompt [V.UX.3].
 */
function EmptyState() {
  return (
    <section className="rounded-2xl border border-muted/15 bg-linear-to-br from-brand/5 via-transparent to-brand/5 px-6 py-12 text-center">
      <div
        aria-hidden
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-4xl"
      >
        ✈️
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Plan your first trip — takes 30 seconds</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Pick a destination, set the dates, let our AI draft a paced day-by-day itinerary you can
        edit, vote on, and share.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90"
        >
          ✨ Start the 3-step wizard
        </Link>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 rounded-md border border-muted/30 px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-muted/10"
        >
          Or create a blank trip →
        </Link>
      </div>
    </section>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const e = error as { code?: string; message?: string; status?: number };
  // 401 from the api means the in-memory token expired or was rejected.
  // We don't auto-clear here so the user sees the diagnostic; explicit
  // sign-out is one click away.
  return (
    <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      Couldn't load trips ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
    </p>
  );
}
