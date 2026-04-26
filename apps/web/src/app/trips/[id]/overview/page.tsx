/**
 * Trip overview composite page — `/trips/:id/overview`. Calls the
 * api's `useTripControllerOverview` hook (which composes 7 sibling
 * use-cases server-side) and renders each section as its own Card
 * with a Badge for ok / graceful-skip status.
 *
 * The api uses per-section graceful degradation (`Section<T>` =
 * `{ok:true, data} | {ok:false, code}` — see ADR-013): a sub-fetch
 * failure (dead provider, missing trip dates for stays, etc.)
 * surfaces as a greyed-out widget instead of 500-ing the whole page.
 *
 * The api's openapi.yaml lacks a strict schema for this composite
 * (the discriminated `Section<T>` shape needs `oneOf` typing — coming
 * in a follow-up slice). For now we declare a local matching type and
 * cast through unknown.
 *
 * Installed by prompt [IV.18.19.32].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTripControllerOverview, type TripDto } from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

type Section<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string };

interface ItineraryDayLike {
  readonly id: string;
  readonly date: string;
  readonly summary: string | null;
  readonly items: readonly { readonly id: string }[];
}
interface ListLike<T = unknown> {
  readonly length: number;
  readonly slice: (start: number, end?: number) => readonly T[];
}

interface OverviewBody {
  readonly trip: TripDto;
  readonly itinerary: Section<readonly ItineraryDayLike[]>;
  readonly weather: Section<{ readonly daily?: unknown }>;
  readonly stays: Section<{ readonly list?: ListLike }>;
  readonly eateries: Section<{ readonly list?: ListLike }>;
  readonly events: Section<{ readonly list?: ListLike }>;
  readonly transport: Section<{ readonly legs?: ListLike }>;
  readonly media: Section<{ readonly count: number; readonly recent: readonly unknown[] }>;
}

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
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

  const body = data as unknown as OverviewBody;

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
        <SectionCard
          title="Itinerary"
          section={body.itinerary}
          render={(days) => (
            <p className="text-sm text-muted">
              {days.length} {days.length === 1 ? 'day' : 'days'} ·{' '}
              {days.reduce((sum, d) => sum + d.items.length, 0)} items
            </p>
          )}
        />
        <SectionCard
          title="Weather"
          section={body.weather}
          render={() => <p className="text-sm text-muted">Forecast loaded</p>}
        />
        <SectionCard
          title="Stays"
          section={body.stays}
          render={(d) => <p className="text-sm text-muted">{d.list?.length ?? 0} listings</p>}
        />
        <SectionCard
          title="Eateries"
          section={body.eateries}
          render={(d) => <p className="text-sm text-muted">{d.list?.length ?? 0} eateries</p>}
        />
        <SectionCard
          title="Events"
          section={body.events}
          render={(d) => <p className="text-sm text-muted">{d.list?.length ?? 0} events</p>}
        />
        <SectionCard
          title="Transport"
          section={body.transport}
          render={(d) => <p className="text-sm text-muted">{d.legs?.length ?? 0} legs</p>}
        />
        <SectionCard
          title="Media"
          section={body.media}
          render={(d) => (
            <p className="text-sm text-muted">
              {d.count} {d.count === 1 ? 'asset' : 'assets'} · {d.recent.length} recent
            </p>
          )}
        />
      </div>
    </main>
  );
}

interface SectionCardProps<T> {
  readonly title: string;
  readonly section: Section<T>;
  readonly render: (data: T) => React.ReactNode;
}

function SectionCard<T>({ title, section, render }: SectionCardProps<T>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {section.ok ? (
            <Badge variant="brand">ok</Badge>
          ) : (
            <Badge variant="neutral">{section.code}</Badge>
          )}
        </div>
        {!section.ok ? <CardSubtitle>Skipped — see code badge for the reason.</CardSubtitle> : null}
      </CardHeader>
      {section.ok ? render(section.data) : null}
    </Card>
  );
}
