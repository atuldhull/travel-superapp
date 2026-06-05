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
 * Installed by prompt [IV.18.19.21]; V.UX.3 polish [V.UX.3]; restyled
 * into the v2 ("Fusion") design language (royal/gold tokens, font-
 * display, never-wrong gradient trip cards) alongside the new landing.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, LogOut, Plus, RotateCcw, Sparkles } from 'lucide-react';
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
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { clearAccessToken } from '../../lib/auth-store';
import { coerceTripDate } from '../../lib/trip-dto';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { useShortcut } from '../../lib/use-shortcuts';
import { useVimListNav } from '../../lib/use-vim-list-nav';

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
      // POST.8 — toast() also calls announce() internally so the
      // ARIA live region still fires for screen-reader users.
      toast.success('Trip archived');
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      toast.error(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Archive failed.'}`);
    }
  }
  async function handleUnarchive(id: string) {
    try {
      await unarchive.mutateAsync({ id });
      await refreshLists();
      toast.success('Trip restored to active');
    } catch (err) {
      const e = err as { code?: string; message?: string; status?: number };
      toast.error(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Unarchive failed.'}`);
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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /feed. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-9 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <Compass aria-hidden className="h-3.5 w-3.5" /> Your journeys
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Your trips
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/65">
              Every journey you’ve planned — pick one up, or start the next.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              <Plus aria-hidden className="h-4 w-4" /> New trip
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <WelcomeBackHero previousSeenAt={previousSeenAt ?? null} />

      <SuggestionsHero queryData={suggestionsQuery.data} />

      <nav aria-label="Trip filter" className="flex gap-1 border-b border-gold-600/15">
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
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="mt-3 h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </Card>
          ))}
        </ul>
      ) : isError ? (
        <ErrorState error={error} />
      ) : trips.length === 0 && collaborated.length === 0 ? (
        tab === 'archived' ? (
          <Card depth="flat" className="p-5">
            <p className="text-sm text-muted">
              No archived trips yet. Trips auto-archive after 365 days, or you can archive manually
              from the Active tab.
            </p>
          </Card>
        ) : (
          <EmptyState />
        )
      ) : (
        <div ref={listRef} className="space-y-6">
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
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Link
          href="/home"
          className="text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          ← Back home
        </Link>
        {trips.length > 0 ? (
          <Link
            href="/onboarding?tour=true"
            className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Replay onboarding tour
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
      className={cn(
        '-mb-px rounded-t-lg border-b-2 px-4 pb-2.5 pt-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        active
          ? 'border-gold-500 text-gold-700 dark:text-gold-300'
          : 'border-transparent text-muted hover:text-surface-foreground',
      )}
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
    <Card depth="raised" className="border-gold-600/30 bg-gold-500/5">
      <CardHeader>
        <CardTitle className="font-display">👋 Welcome back</CardTitle>
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
    <Card depth="raised">
      <CardHeader>
        <CardTitle className="font-display text-xl">Plan something new</CardTitle>
        <CardSubtitle>
          Curated picks based on where you&apos;ve been. Tap to start a trip there.
        </CardSubtitle>
      </CardHeader>
      <ul className="grid gap-3 sm:grid-cols-3">
        {suggestions.map((s) => (
          <li
            key={s.destination}
            className="flex flex-col rounded-2xl border border-gold-600/15 bg-surface/50 p-4 text-sm transition hover:border-gold-600/30 hover:shadow-(--shadow-depth-1)"
          >
            <p className="font-display text-base font-semibold tracking-tight text-surface-foreground">
              {s.destination}
            </p>
            <p className="mt-1 text-xs text-muted">{s.hook}</p>
            {s.anchor ? <p className="mt-1 text-[10px] italic text-muted/80">{s.anchor}</p> : null}
            <Link
              href={
                `/trips/new?title=${encodeURIComponent(s.destination)}&lat=${s.lat}&lng=${s.lng}` as never
              }
              className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-500/12 px-3 py-1.5 text-xs font-semibold text-gold-700 transition hover:bg-gold-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
            >
              <Sparkles aria-hidden className="h-3.5 w-3.5" /> Plan a trip
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
  // Draft trips read as neutral; everything live earns the gold badge.
  const statusVariant: 'neutral' | 'gold' = trip.status === 'draft' ? 'neutral' : 'gold';
  const place = trip.title.replace(SAMPLE_TRIP_PREFIX, '');
  return (
    <Card
      as="li"
      depth="raised"
      interactive
      className={cn('overflow-hidden', role === 'collaborator' && 'border-emerald-500/40')}
    >
      {/* Never-wrong royal-gradient cover (replaces the unreliable
          keyword photo lookup) — a calm, on-brand backdrop with the
          destination name in serif. */}
      <Link
        href={`/trips/${trip.id}` as never}
        tabIndex={-1}
        aria-hidden
        className="relative mb-4 grid aspect-video place-items-center overflow-hidden rounded-xl border border-gold-500/15"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold-500/25 blur-2xl"
        />
        <Compass aria-hidden className="h-8 w-8 text-white/45" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-center font-display text-base font-semibold tracking-tight text-white">
          {place}
        </span>
      </Link>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/trips/${trip.id}` as never}
            data-vim-item
            className="rounded outline-none transition hover:text-gold-700 focus:ring-2 focus:ring-accent dark:hover:text-gold-300"
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
      {(() => {
        const starts = coerceTripDate(trip.startsOn);
        const ends = coerceTripDate(trip.endsOn);
        return starts && ends ? (
          <p className="text-sm text-muted">
            {new Date(starts).toLocaleDateString()} → {new Date(ends).toLocaleDateString()}
          </p>
        ) : (
          <p className="text-sm text-muted">No dates yet</p>
        );
      })()}
      {onArchive ? (
        <button
          type="button"
          onClick={onArchive}
          aria-label={`Archive ${trip.title}`}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-gold-600/20 px-3 py-1 text-xs text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          📦 Archive
        </button>
      ) : null}
      {onUnarchive ? (
        <button
          type="button"
          onClick={onUnarchive}
          aria-label={`Unarchive ${trip.title}`}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-gold-600/20 px-3 py-1 text-xs text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
 * Installed by prompt [V.UX.3]; v2 restyle (gold gradient + tokens).
 */
function EmptyState() {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 bg-gradient-to-br from-gold-500/8 via-transparent to-brand/5 px-6 py-14 text-center shadow-(--shadow-depth-1)">
      <div
        aria-hidden
        className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 text-4xl"
      >
        ✈️
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-surface-foreground sm:text-3xl">
        Plan your first trip — takes 30 seconds
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Pick a destination, set the dates, let our AI draft a paced day-by-day itinerary you can
        edit, vote on, and share.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Sparkles aria-hidden className="h-4 w-4" /> Start the 3-step wizard
        </Link>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 rounded-full border border-gold-600/30 px-6 py-3 text-sm font-semibold text-surface-foreground transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
    <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      Couldn&apos;t load trips ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
    </p>
  );
}
