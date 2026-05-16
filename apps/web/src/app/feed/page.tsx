/**
 * /feed — the 2.0 social pull feed (POST.2B.3) + the "trips like
 * this" pgvector discovery rail (POST.2C.3).
 *
 * Reverse-chronological published trips from people you follow +
 * public, visibility + block filtered server-side (LAW 2 lives in
 * the domain — the UI just renders what it's allowed to see).
 * Cursor pagination via `nextBefore`. Empty + loading states reuse
 * the 1.0 EmptyState / SkeletonList primitives.
 *
 * apiFetch-direct (the SDK regen for the 2.0 surface is a tracked
 * deferred seam) — all typing flows through lib/two-oh-api.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import {
  getSocialFeed,
  getSimilarTrips,
  type SimilarTrip,
  type TripPublicationDto,
} from '../../lib/two-oh-api';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { SkeletonList } from '../../components/ui/skeleton';
import { RelativeTime } from '../../components/ui/relative-time';
import { Button } from '../../components/ui/button';

const VIS_LABEL: Record<string, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Followers',
  PRIVATE: 'Private',
};

function VisibilityBadge({ v }: { v: string }) {
  return (
    <span className="rounded-full border border-muted/30 bg-muted/10 px-2 py-0.5 text-xs text-muted">
      {VIS_LABEL[v] ?? v}
    </span>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [items, setItems] = useState<readonly TripPublicationDto[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<readonly SimilarTrip[]>([]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSocialFeed({ limit: 20 });
      setItems(res.items);
      setNextBefore(res.nextBefore);
      // Seed the discovery rail from the most-recent published trip.
      const seed = res.items[0];
      if (seed) {
        try {
          const sim = await getSimilarTrips(seed.tripId, 6);
          setSimilar(sim.items);
        } catch {
          setSimilar([]); // no embeddings / Ollama absent → quiet
        }
      }
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(e.code ?? `HTTP_${e.status ?? '???'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bootComplete) return;
    if (token === null) {
      router.push('/login?next=/feed' as Route);
      return;
    }
    void loadFirst();
  }, [bootComplete, token, router, loadFirst]);

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getSocialFeed({ limit: 20, before: nextBefore });
      setItems((prev) => [...prev, ...res.items]);
      setNextBefore(res.nextBefore);
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(e.code ?? `HTTP_${e.status ?? '???'}`);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Feed</h1>
        <p className="text-sm text-muted">Published trips from people you follow, newest first.</p>
      </header>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          Couldn&apos;t load the feed ({error}).
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🧭"
          title="Your feed is quiet"
          body="Follow a few travelers, or publish one of your own ended trips, and their journeys show up here."
          cta={{ href: '/trips', label: 'Go to your trips' }}
        />
      ) : (
        <>
          <ul className="grid gap-4">
            {items.map((p) => (
              <Card as="li" key={p.tripId}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>
                      <Link
                        href={`/trips/${p.tripId}` as Route}
                        className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Trip {p.tripId.slice(0, 8)}
                      </Link>
                    </CardTitle>
                    <VisibilityBadge v={p.visibility} />
                  </div>
                  <CardSubtitle>
                    {p.publishedAt ? (
                      <>
                        Published <RelativeTime at={p.publishedAt} />
                      </>
                    ) : (
                      'Unpublished'
                    )}
                    {p.exposedLat !== null && p.exposedLng !== null ? (
                      <>
                        {' · ~'}
                        {p.exposedLat.toFixed(1)},{p.exposedLng.toFixed(1)}
                      </>
                    ) : null}
                  </CardSubtitle>
                </CardHeader>
              </Card>
            ))}
          </ul>
          {nextBefore ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {!loading && similar.length > 0 ? (
        <section aria-labelledby="similar-h" className="space-y-3 border-t border-muted/10 pt-6">
          <h2 id="similar-h" className="text-lg font-semibold">
            Trips like this
          </h2>
          <p className="text-sm text-muted">
            Real published trips near the top of your feed (pgvector discovery).
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {similar.map((s) => (
              <li key={s.tripId}>
                <Link
                  href={`/trips/${s.tripId}` as Route}
                  className="block rounded-md border border-muted/15 bg-surface px-3 py-2 text-sm hover:border-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="font-medium">{s.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
