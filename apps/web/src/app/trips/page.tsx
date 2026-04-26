/**
 * Protected trips list. Reads `useAuthToken()` — if no token, the user
 * is bounced to `/login`. Otherwise calls the auth-gated `GET /trips`
 * via the generated `useTripControllerList` hook.
 *
 * The bounce happens client-side because tokens live in memory only
 * (CLAUDE rule 12) — server components can't see the token, so the
 * server can't redirect on the basis of it. A future slice will add
 * silent-refresh on mount so a hard reload doesn't always bounce.
 *
 * Installed by prompt [IV.18.19.21].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTripControllerList, type ListTripsResponseDto, type TripDto } from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { clearAccessToken } from '../../lib/auth-store';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

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
      ) : trips.length === 0 ? (
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          No trips yet — use the <strong>New trip</strong> button to compose one.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </ul>
      )}
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back home
        </Link>
      </p>
    </main>
  );
}

function TripCard({ trip }: { trip: TripDto }) {
  const statusVariant: 'neutral' | 'brand' = trip.status === 'draft' ? 'neutral' : 'brand';
  return (
    <Card as="li">
      <CardHeader>
        <CardTitle>
          <Link href={`/trips/${trip.id}` as never} className="hover:underline">
            {trip.title}
          </Link>
        </CardTitle>
        <CardSubtitle>
          <Badge variant={statusVariant}>{trip.status}</Badge> · Radius {trip.radiusKm}km
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
