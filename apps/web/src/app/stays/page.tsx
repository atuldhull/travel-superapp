/**
 * /stays — real hotel meta-search.
 *
 * No fake/seed listings: the traveller enters destination + dates +
 * guests + rooms, and we deep-link them straight to trusted booking
 * sites (Booking.com, Agoda, Airbnb, Expedia, Hotels.com, MakeMyTrip,
 * Goibibo, KAYAK, Trivago, Hostelworld, Google Hotels) with the search
 * pre-filled — live prices + real inventory, booked on that site.
 *
 * Auth-gated like the rest of the app; redirects to /login when signed
 * out. Restyled into the v2 design.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, DoorOpen, ExternalLink, MapPin, Search, Users } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { BOOKING_PARTNERS, type StaySearch } from '../../components/v2/booking-partners';
import { cn } from '../../lib/cn';

const FIELD =
  'w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function StaysPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [destination, setDestination] = useState('');
  // Dates default on the client (avoids any SSR/clock hydration mismatch).
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);

  useEffect(() => {
    setCheckIn(plusDays(14));
    setCheckOut(plusDays(16));
  }, []);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/stays');
  }, [bootComplete, token, router]);

  const query: StaySearch = useMemo(
    () => ({ destination, checkIn, checkOut, guests, rooms }),
    [destination, checkIn, checkOut, guests, rooms],
  );
  const ready = destination.trim().length > 0 && checkIn !== '' && checkOut !== '';

  if (!bootComplete)
    return (
      <main>
        <p className="text-muted">Restoring session…</p>
      </main>
    );
  if (token === null)
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <MapPin aria-hidden className="h-3.5 w-3.5" /> Where you’ll stay
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Find your stay
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Tell us where and when — we send you straight to the web’s most trusted booking sites with
          your search ready. Live prices, real rooms, booked on their side.
        </p>
      </header>

      {/* Search form */}
      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Your search</CardTitle>
          <CardSubtitle>Fill this in, then tap any site below to open it pre-filled.</CardSubtitle>
        </CardHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-surface-foreground">
              Where to?
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-gold-600/25 bg-surface px-3.5 py-2.5 transition focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/25">
              <MapPin aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City, area or hotel — e.g. Goa, Paris, Tokyo"
                aria-label="Destination"
                autoFocus
                className="w-full bg-transparent text-sm text-surface-foreground outline-none placeholder:text-muted/70"
              />
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-surface-foreground">
                <CalendarDays aria-hidden className="h-3.5 w-3.5 text-gold-600" /> Check-in
              </span>
              <input
                type="date"
                value={checkIn}
                min={plusDays(0)}
                onChange={(e) => setCheckIn(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-surface-foreground">
                <CalendarDays aria-hidden className="h-3.5 w-3.5 text-gold-600" /> Check-out
              </span>
              <input
                type="date"
                value={checkOut}
                min={checkIn || plusDays(1)}
                onChange={(e) => setCheckOut(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-surface-foreground">
                <Users aria-hidden className="h-3.5 w-3.5 text-gold-600" /> Guests
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                className={FIELD}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1.5 font-medium text-surface-foreground">
                <DoorOpen aria-hidden className="h-3.5 w-3.5 text-gold-600" /> Rooms
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={rooms}
                onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
                className={FIELD}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Trusted booking sites */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600 dark:text-gold-400">
              Compare &amp; book on
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-surface-foreground">
              {BOOKING_PARTNERS.length} trusted sites
            </h2>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Search aria-hidden className="h-3.5 w-3.5" /> Opens in a new tab with your search
          </p>
        </div>

        {!ready ? (
          <p className="rounded-2xl border border-gold-600/20 bg-gold-500/5 px-4 py-3 text-sm text-muted">
            Enter a destination above to light up the booking sites.
          </p>
        ) : null}

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BOOKING_PARTNERS.map((p) => {
            const cardInner = (
              <>
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
                  style={{ backgroundColor: p.accent }}
                />
                <div className="flex items-start justify-between gap-3 pl-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold tracking-tight text-surface-foreground">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{p.blurb}</p>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                      ready
                        ? 'bg-gold-500/12 text-gold-700 group-hover:bg-gold-500/20 dark:text-gold-300'
                        : 'bg-muted/10 text-muted',
                    )}
                  >
                    Search <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                  </span>
                </div>
              </>
            );
            const cls =
              'group relative flex flex-col overflow-hidden rounded-2xl border border-gold-600/12 bg-surface p-5 shadow-(--shadow-depth-1) transition';
            return (
              <li key={p.key}>
                {ready ? (
                  <a
                    href={p.build(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Search ${p.name} for stays in ${destination}`}
                    className={cn(
                      cls,
                      'hover:-translate-y-1 hover:border-gold-600/30 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                  >
                    {cardInner}
                  </a>
                ) : (
                  <div className={cn(cls, 'opacity-60')} aria-disabled>
                    {cardInner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-xs leading-relaxed text-muted/80">
          We don’t store, mark up, or fake prices — each site shows its own live availability for
          your dates and you book there. Most sites pre-fill your dates &amp; guests; a few (the
          India OTAs, Trivago, Google) open to your destination.
        </p>
      </section>
    </main>
  );
}
