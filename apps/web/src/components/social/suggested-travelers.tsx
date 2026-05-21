/**
 * Phase 5 (J3) — "Discover travellers" rail.
 *
 * A horizontal strip of people to follow: authors of public trips
 * the viewer doesn't follow yet, ranked $0 by how prolific they are.
 * Each card has an inline Follow button — following optimistically
 * drops the card (a followed user is no longer a "discover" hit).
 *
 * Renders nothing when there are no suggestions, so the feed page
 * can mount it unconditionally.
 *
 * Installed by prompt [J3].
 */
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { Compass, UserRound } from 'lucide-react';
import { followUser, getSuggestedTravellers, type SuggestedTraveller } from '../../lib/two-oh-api';
import { toast } from '../ui/toast';

export function SuggestedTravelers() {
  const [people, setPeople] = useState<readonly SuggestedTraveller[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await getSuggestedTravellers(12);
        if (alive) setPeople(res.travellers);
      } catch {
        if (alive) setPeople([]);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const follow = async (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    try {
      await followUser(userId);
      toast.success('Following.');
      // A followed user is no longer a discovery suggestion — drop it.
      setPeople((prev) => prev.filter((p) => p.userId !== userId));
    } catch (err) {
      const e = err as { code?: string; status?: number };
      toast.error(`Couldn't follow (${e.code ?? e.status ?? 'error'}).`);
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to show — render nothing (no empty-state noise on the feed).
  if (!loaded || people.length === 0) return null;

  return (
    <section aria-labelledby="discover-people-h" className="space-y-4">
      <div className="flex items-center gap-3">
        <h2
          id="discover-people-h"
          className="inline-flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"
        >
          <Compass aria-hidden className="h-5 w-5 text-gold-600" /> Travellers to follow
        </h2>
        <span aria-hidden className="h-px flex-1 bg-gold-600/20" />
      </div>
      <p className="text-sm text-muted">
        People sharing public journeys you don&apos;t follow yet.
      </p>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {people.map((p) => (
          <li key={p.userId} className="min-w-56 shrink-0 snap-start">
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-gold-600/15 bg-surface p-4 shadow-(--shadow-depth-1)">
              <Link
                href={`/users/${p.userId}` as Route}
                className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-600/25 bg-gold-500/10">
                  <UserRound aria-hidden className="h-4 w-4 text-gold-600" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-surface-foreground">
                    {p.displayName}
                  </span>
                  <span className="block text-xs text-muted">
                    {p.publishedCount} public trip{p.publishedCount === 1 ? '' : 's'}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void follow(p.userId)}
                disabled={busyId === p.userId}
                className="rounded-full bg-gold-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {busyId === p.userId ? 'Following…' : 'Follow'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
