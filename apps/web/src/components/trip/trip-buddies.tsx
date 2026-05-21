/**
 * Phase 5 (J5) — "Travellers near your trip" rail.
 *
 * Other PUBLIC published trips around the same place — a $0 place
 * heuristic. Published trips are always ended, so this shows people
 * who've JOURNEYED near your destination (their travel dates are
 * shown for context), not future companions. Owner-only: the API
 * matches buddies for the caller's own trip.
 *
 * Renders nothing when there are no matches, so the trip page can
 * mount it unconditionally.
 *
 * Installed by prompt [J5].
 */
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { Users, MapPin, ArrowUpRight } from 'lucide-react';
import { getTripBuddies, type TripBuddy } from '../../lib/two-oh-api';

function fmtRange(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn || !endsOn) return null;
  const s = new Date(startsOn);
  const e = new Date(endsOn);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString(undefined, opt)} → ${e.toLocaleDateString(undefined, opt)}`;
}

export function TripBuddies({ tripId }: { readonly tripId: string }) {
  const [buddies, setBuddies] = useState<readonly TripBuddy[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await getTripBuddies(tripId, 12);
        if (alive) setBuddies(res.buddies);
      } catch {
        // owner-gate 404 / no location → just render nothing
        if (alive) setBuddies([]);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  if (!loaded || buddies.length === 0) return null;

  return (
    <section
      aria-labelledby="trip-buddies-h"
      className="rounded-2xl border border-gold-600/15 bg-surface/60 p-5"
    >
      <h2
        id="trip-buddies-h"
        className="flex items-center gap-2 font-display text-lg font-semibold text-surface-foreground"
      >
        <Users aria-hidden className="h-5 w-5 text-gold-600" /> Travellers near your trip
      </h2>
      <p className="mt-1 text-sm text-muted">
        Other travellers who&apos;ve shared a public journey near your destination.
      </p>
      <ul className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {buddies.map((b) => {
          const range = fmtRange(b.startsOn, b.endsOn);
          return (
            <li key={b.tripId} className="min-w-60 shrink-0 snap-start">
              {/* Sibling links — never nest <a> in <a>. */}
              <div className="flex h-full flex-col gap-2 rounded-2xl border border-gold-600/15 bg-surface p-4 shadow-(--shadow-depth-1)">
                <Link
                  href={`/trips/${b.tripId}` as Route}
                  className="group flex items-start justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="font-display text-base font-semibold leading-snug text-surface-foreground">
                    {b.title}
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-600"
                  />
                </Link>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <MapPin aria-hidden className="h-3.5 w-3.5" />~{b.exposedLat.toFixed(1)},
                  {b.exposedLng.toFixed(1)}
                </span>
                {range ? <span className="text-xs text-muted">{range}</span> : null}
                <Link
                  href={`/users/${b.authorId}` as Route}
                  className="mt-1 w-fit text-xs text-gold-600 underline-offset-4 hover:underline"
                >
                  View traveller
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
