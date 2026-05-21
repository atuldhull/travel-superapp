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
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Compass, MapPin, Sparkles } from 'lucide-react';
import { EmptyState } from '../../components/ui/empty-state';
import { SuggestedTravelers } from '../../components/social/suggested-travelers';
import { SkeletonList } from '../../components/ui/skeleton';
import { RelativeTime } from '../../components/ui/relative-time';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const VIS_LABEL: Record<string, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Followers',
  PRIVATE: 'Private',
};

function VisibilityBadge({ v }: { v: string }) {
  const variant = v === 'PUBLIC' ? 'gold' : v === 'FOLLOWERS' ? 'brand' : 'neutral';
  return <Badge variant={variant}>{VIS_LABEL[v] ?? v}</Badge>;
}

export default function FeedPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const reduce = useReducedMotion();

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
    <main className="space-y-10">
      {/* Cinematic header band. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-10 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Compass aria-hidden className="h-3.5 w-3.5" /> Discover
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          The Feed
        </h1>
        <p className="relative mt-2 max-w-md text-sm text-white/65">
          Published journeys from the travellers you follow — newest first.
        </p>
      </header>

      {/* J3 — discover travellers to follow. Self-hides when there
          are no suggestions; shown above the feed so it also helps
          a brand-new user whose feed is still empty. */}
      <SuggestedTravelers />

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <p
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-sm text-danger shadow-(--shadow-depth-1)"
        >
          Couldn&apos;t load the feed ({error}).
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🧭"
          title="Your feed is quiet"
          body="Follow a few travellers, or publish one of your own ended trips, and their journeys appear here."
          cta={{ href: '/trips', label: 'Go to your trips' }}
        />
      ) : (
        <>
          <motion.ul
            className="grid gap-5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.06 } } }}
          >
            {items.map((p) => (
              <motion.li
                key={p.tripId}
                variants={{
                  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                <Link
                  href={`/trips/${p.tripId}` as Route}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-gold-600/12 bg-surface p-5 shadow-(--shadow-depth-1) transition duration-200 hover:-translate-y-1 hover:border-gold-600/30 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundImage: 'var(--gradient-gold)' }}
                  />
                  <span
                    aria-hidden
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-(--shadow-depth-2)"
                    style={{ backgroundImage: 'var(--gradient-royal)' }}
                  >
                    <Compass className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
                        Trip {p.tripId.slice(0, 8)}
                      </span>
                      <VisibilityBadge v={p.visibility} />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                      {p.publishedAt ? (
                        <>
                          Published&nbsp;
                          <RelativeTime at={p.publishedAt} />
                        </>
                      ) : (
                        'Unpublished'
                      )}
                      {p.exposedLat !== null && p.exposedLng !== null ? (
                        <span className="inline-flex items-center gap-1 text-muted/80">
                          <MapPin aria-hidden className="h-3.5 w-3.5" />~{p.exposedLat.toFixed(1)},
                          {p.exposedLng.toFixed(1)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-600"
                  />
                </Link>
              </motion.li>
            ))}
          </motion.ul>
          {nextBefore ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more journeys'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {!loading && similar.length > 0 ? (
        <section aria-labelledby="similar-h" className="space-y-4">
          <div className="flex items-center gap-3">
            <h2
              id="similar-h"
              className="inline-flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"
            >
              <Sparkles aria-hidden className="h-5 w-5 text-gold-600" /> Trips like this
            </h2>
            <span aria-hidden className="h-px flex-1 bg-gold-600/20" />
          </div>
          <p className="text-sm text-muted">
            Real published trips near the top of your feed — pgvector discovery.
          </p>
          <ul className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
            {similar.map((s) => (
              <li key={s.tripId} className="min-w-60 shrink-0 snap-start">
                <Link
                  href={`/trips/${s.tripId}` as Route}
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-gold-500/25 p-5 text-white shadow-(--shadow-depth-2) transition duration-200 hover:-translate-y-1 hover:shadow-(--shadow-glow) focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                  style={{ backgroundImage: 'var(--gradient-royal)' }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-500/20 blur-2xl"
                  />
                  <span className="relative font-display text-lg font-semibold leading-snug">
                    {s.title}
                  </span>
                  <span className="relative mt-6 inline-flex items-center gap-1 text-xs text-gold-300">
                    Explore
                    <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
