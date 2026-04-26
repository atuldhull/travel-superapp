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
import { useEffect } from 'react';
import {
  useTripControllerOverview,
  type OverviewSectionFailureDto,
  type TripOverviewResponseDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

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
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load overview ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
        <p>
          <Link href={`/trips/${id}` as never} className="text-sm text-muted hover:underline">
            ← Back to trip
          </Link>
        </p>
      </main>
    );
  }

  const body = data as unknown as TripOverviewResponseDto;

  return (
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${id}` as never} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{body.trip.title}</h1>
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
