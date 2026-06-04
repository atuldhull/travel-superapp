/**
 * Trip overview composite page — `/trips/:id/overview`. Calls the
 * api's `useTripControllerOverview` hook (which composes 7 sibling
 * use-cases server-side) and renders each section as its own Card
 * with a Badge for ok / graceful-skip status.
 *
 * The api uses per-section graceful degradation (`Section<T>` =
 * `{ok: true, data} | {ok: false, code}` — see ADR-013): a sub-fetch
 * failure (dead provider, missing trip dates for stays, etc.)
 * surfaces as a greyed-out widget instead of 500-ing the whole page.
 *
 * The composite is fully typed via `TripOverviewResponseDto` from
 * @app/sdk (added in [IV.18.19.33] — Section<T> oneOf).
 *
 * Installed by prompt [IV.18.19.32]; rewired to typed schema in
 * [IV.18.19.33].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  useTripControllerOverview,
  type OverviewSectionFailureDto,
  type TripOverviewResponseDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';
import {
  loadTripSnapshot,
  saveTripSnapshot,
  formatSavedAt,
  type OfflineTripSnapshot,
} from '../../../../lib/offline-trip-cache';
import { useOnline } from '../../../../lib/use-online';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

/**
 * Discriminator. Orval emits `ok: boolean` (not `true|false` literal),
 * so TS can't narrow on `section.ok` alone — but the failure variant
 * has `code: string` and no `data`, so checking for `data` works as
 * a structural narrow.
 */
function isOk<T extends { data: unknown }>(section: T | OverviewSectionFailureDto): section is T {
  return 'data' in section && (section as { data?: unknown }).data !== undefined;
}

export default function TripOverviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useTripControllerOverview(id, {
    query: { enabled: token !== null && id !== '' },
  });

  // I2 (Phase 6) — offline snapshot: on successful overview fetches,
  // mirror to IDB so this page (and the recap page) survive a network
  // drop. On failure, fall back to the cached snapshot and badge it.
  const online = useOnline();
  const [snapshot, setSnapshot] = useState<OfflineTripSnapshot | null>(null);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const snap = id ? await loadTripSnapshot(id) : null;
      if (alive) {
        setSnapshot(snap);
        setSnapshotLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  useEffect(() => {
    // Save on every successful fetch — the cheapest path to keeping
    // the cache fresh. We pull trip meta out of the overview itself
    // (it includes `body.trip`) instead of round-tripping /trips/:id.
    if (!data || !id) return;
    const body = (data as { data?: unknown }).data as TripOverviewResponseDto | undefined;
    if (!body) return;
    void saveTripSnapshot({
      tripId: id,
      trip: body.trip,
      overview: data,
      title: body.trip?.title ?? null,
    });
  }, [data, id]);

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
  if (isLoading) {
    return (
      <main className="space-y-8">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} depth="raised">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </main>
    );
  }
  // I2 — when the live overview fetch errors and we have an offline
  // snapshot, recover from cache instead of crashing the page. The
  // user sees a soft "Offline copy" badge so the staleness is honest.
  if (isError && snapshotLoaded && !snapshot) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load overview ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
        <p>
          <Link
            href={`/trips/${id}` as never}
            className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
          </Link>
        </p>
      </main>
    );
  }

  // Choose the live envelope when present, else the cached one.
  const liveBody = data?.data as unknown as TripOverviewResponseDto | undefined;
  const cachedBody =
    snapshot && snapshot.overview
      ? ((snapshot.overview as { data?: TripOverviewResponseDto }).data ?? null)
      : null;
  const body = liveBody ?? cachedBody;
  if (!body) {
    // Nothing live, nothing cached — still loading the snapshot or
    // truly no data. The skeleton above handles the loading case;
    // here we just bail out cleanly.
    if (isError || !snapshotLoaded) return null;
    return null;
  }
  const renderingFromCache = !liveBody && Boolean(cachedBody);

  return (
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${id}` as never} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{body.trip.title}</h1>
          {renderingFromCache || !online ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-700 dark:text-gold-300"
              title="The network is unreachable. This is the snapshot saved on this device the last time the overview loaded online."
            >
              Offline copy
              {snapshot ? ` · saved ${formatSavedAt(snapshot.savedAt) ?? 'a while ago'}` : null}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          Overview · 7 sections · per-section graceful degradation
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Itinerary" section={body.itinerary}>
          {(s) => (
            <p className="text-sm text-muted">
              {s.data.days.length} {s.data.days.length === 1 ? 'day' : 'days'} ·{' '}
              {s.data.days.reduce((sum, d) => sum + d.items.length, 0)} items
            </p>
          )}
        </SectionCard>
        <SectionCard title="Weather" section={body.weather}>
          {() => <p className="text-sm text-muted">Forecast loaded</p>}
        </SectionCard>
        <SectionCard title="Stays" section={body.stays}>
          {(s) => <p className="text-sm text-muted">{s.data.list.length} listings</p>}
        </SectionCard>
        <SectionCard title="Eateries" section={body.eateries}>
          {(s) => <p className="text-sm text-muted">{s.data.list.length} eateries</p>}
        </SectionCard>
        <SectionCard title="Events" section={body.events}>
          {(s) => <p className="text-sm text-muted">{s.data.list.length} events</p>}
        </SectionCard>
        <SectionCard title="Transport" section={body.transport}>
          {(s) => <p className="text-sm text-muted">{s.data.legs.length} legs</p>}
        </SectionCard>
        <SectionCard title="Media" section={body.media}>
          {(s) => (
            <p className="text-sm text-muted">
              {s.data.count} {s.data.count === 1 ? 'asset' : 'assets'} · {s.data.recent.length}{' '}
              recent
            </p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

interface SectionCardProps<T extends { data: unknown }> {
  readonly title: string;
  readonly section: T | OverviewSectionFailureDto;
  readonly children: (success: T) => React.ReactNode;
}

function SectionCard<T extends { data: unknown }>({
  title,
  section,
  children,
}: SectionCardProps<T>) {
  const ok = isOk<T>(section);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {ok ? (
            <Badge variant="brand">ok</Badge>
          ) : (
            <Badge variant="neutral">{(section as OverviewSectionFailureDto).code}</Badge>
          )}
        </div>
        {!ok ? <CardSubtitle>Skipped — see code badge for the reason.</CardSubtitle> : null}
      </CardHeader>
      {ok ? children(section) : null}
    </Card>
  );
}
