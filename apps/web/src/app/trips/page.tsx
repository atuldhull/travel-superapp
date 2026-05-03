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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerListQueryKey,
  useAuthControllerMe,
  useTripControllerArchive,
  useTripControllerList,
  useTripControllerSuggestions,
  useTripControllerUnarchive,
  type ListTripsResponseDto,
  type TripDto,
  type WhoAmIResponseDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { clearAccessToken } from '../../lib/auth-store';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { useShortcut } from '../../lib/use-shortcuts';
import { useVimListNav } from '../../lib/use-vim-list-nav';
import { announce } from '../../lib/announce';

type TabKey = 'active' | 'archived';

const WELCOME_BACK_GAP_MS = 30 * 24 * 60 * 60 * 1000;

interface DestinationSuggestion {
  destination: string;
  countryCode: string;
  lat: number;
  lng: number;
  hook: string;
  anchor: string | null;
}

export default function TripsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('active');

  useEffect(() => {
    // Hold the redirect until silent-refresh has had its chance —
    // otherwise a hard reload always bounces before the httpOnly
    // cookie can resurrect the session.
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const params = { limit: '20', archived: tab === 'archived' ? 'true' : 'false' } as never;
  const { data, isLoading, isError, error } = useTripControllerList(params, {
    query: { enabled: token !== null },
  });
  const me = useAuthControllerMe({
    query: { enabled: token !== null, retry: false },
  });
  // V.UX.30 — suggestions hero (always shown when authed; first-trip
  // users get globally-popular picks).
  const suggestionsQuery = useTripControllerSuggestions({
    query: { enabled: token !== null, retry: false },
  });
  const archive = useTripControllerArchive();
  const unarchive = useTripControllerUnarchive();

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

  async function refreshLists() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getTripControllerListQueryKey({ limit: '20', archived: 'false' } as never),
      }),
      queryClient.invalidateQueries({
        queryKey: getTripControllerListQueryKey({ limit: '20', archived: 'true' } as never),
      }),
    ]);
  }

  async function handleArchive(id: string) {
    try {
      await archive.mutateAsync({ id });
      await refreshLists();
      announce('Trip archived');
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      announce(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Archive failed.'}`,
        'assertive',
      );
    }
  }
  async function handleUnarchive(id: string) {
    try {
      await unarchive.mutateAsync({ id });
      await refreshLists();
      announce('Trip restored to active');
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      announce(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Unarchive failed.'}`,
        'assertive',
      );
    }
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

  const meBody = me.data?.data as WhoAmIResponseDto | undefined;
  const previousSeenAt = meBody?.previousSeenAt as unknown as string | null | undefined;
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

      <WelcomeBackHero previousSeenAt={previousSeenAt ?? null} />

      <SuggestionsHero queryData={suggestionsQuery.data} />

      <nav aria-label="Trip filter" className="flex gap-2 border-b border-muted/15">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          Active
        </TabButton>
        <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>
          Archived
        </TabButton>
      </nav>

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
        tab === 'archived' ? (
          <p className="rounded border border-muted/20 px-4 py-3 text-sm text-muted">
            No archived trips yet. Trips auto-archive after 365 days, or you can archive manually
            from the Active tab.
          </p>
        ) : (
          <EmptyState />
        )
      ) : (
        <div ref={listRef}>
          {trips.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {trips.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  role="owner"
                  onArchive={tab === 'active' ? () => void handleArchive(t.id) : null}
                  onUnarchive={tab === 'archived' ? () => void handleUnarchive(t.id) : null}
                />
              ))}
            </ul>
          ) : null}
          {tab === 'active' && collaborated.length > 0 ? (
            <section className="mt-6 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Shared with you
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {collaborated.map((t) => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    role="collaborator"
                    onArchive={null}
                    onUnarchive={null}
                  />
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

function TabButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition ${
        active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function WelcomeBackHero({ previousSeenAt }: { previousSeenAt: string | null }) {
  const gap = useMemo(() => {
    if (!previousSeenAt) return null;
    const t = new Date(previousSeenAt).getTime();
    if (Number.isNaN(t)) return null;
    return Date.now() - t;
  }, [previousSeenAt]);
  if (gap === null || gap < WELCOME_BACK_GAP_MS) return null;
  const days = Math.floor(gap / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const human = months >= 1 ? `${months} month${months === 1 ? '' : 's'}` : `${days} days`;
  return (
    <Card className="border-brand/40 bg-brand/5">
      <CardHeader>
        <CardTitle>👋 Welcome back!</CardTitle>
        <CardSubtitle>
          It&apos;s been about {human} since your last visit. Pick up where you left off — your
          trips are below, or start something new.
        </CardSubtitle>
      </CardHeader>
    </Card>
  );
}

function SuggestionsHero({
  queryData,
}: {
  readonly queryData: { data?: { suggestions: DestinationSuggestion[] } } | undefined;
}) {
  const suggestions = queryData?.data?.suggestions ?? [];
  if (suggestions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan something new</CardTitle>
        <CardSubtitle>
          Curated picks based on where you&apos;ve been. Tap to start a trip there.
        </CardSubtitle>
      </CardHeader>
      <ul className="grid gap-3 sm:grid-cols-3">
        {suggestions.map((s) => (
          <li key={s.destination} className="rounded border border-muted/20 p-3 text-sm">
            <p className="font-semibold">{s.destination}</p>
            <p className="mt-1 text-xs text-muted">{s.hook}</p>
            {s.anchor ? <p className="mt-1 text-[10px] italic text-muted">{s.anchor}</p> : null}
            <Link
              href={
                `/trips/new?title=${encodeURIComponent(s.destination)}&lat=${s.lat}&lng=${s.lng}` as never
              }
              className="mt-2 inline-block rounded border border-brand/40 px-2 py-1 text-xs text-brand hover:bg-brand/10"
            >
              ✈️ Plan a trip
            </Link>
          </li>
        ))}
      </ul>
    </Card>
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

function TripCard({
  trip,
  role,
  onArchive,
  onUnarchive,
}: {
  trip: TripDto;
  role: 'owner' | 'collaborator';
  onArchive: (() => void) | null;
  onUnarchive: (() => void) | null;
}) {
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
      {onArchive ? (
        <button
          type="button"
          onClick={onArchive}
          aria-label={`Archive ${trip.title}`}
          className="mt-2 rounded border border-muted/30 px-2 py-1 text-xs text-muted hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          📦 Archive
        </button>
      ) : null}
      {onUnarchive ? (
        <button
          type="button"
          onClick={onUnarchive}
          aria-label={`Unarchive ${trip.title}`}
          className="mt-2 rounded border border-muted/30 px-2 py-1 text-xs text-muted hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          ↩️ Unarchive
        </button>
      ) : null}
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
