/**
 * /stays — browse stays.
 *
 * Closes C0's `stays` 0% gap. The `/api/v1/stays/search` endpoint has
 * existed since [V.UX.14]; this page is the standalone surface.
 *
 * Filters mirror the API's accepted params: center+radius, check-in/out,
 * guest count, required amenities, stayType, maxPrice, minWifiSpeedMbps
 * (V.UX.23 nomad-mode). Geolocation prompt with NYC fallback.
 *
 * Installed by [S-Cs] of the S-series real-functionality closeout;
 * restyled into the v2 ("Fusion") design language (royal/gold tokens).
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search, Wifi } from 'lucide-react';
import {
  useStaysControllerSearch,
  type SearchStaysRequestDto,
  type StayListingDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 };

// Shared field styling so every filter input reads as one set.
const FIELD =
  'rounded-lg border border-gold-600/25 bg-surface px-2 py-1 text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

// Today is iso "YYYY-MM-DD"; default check-in = +30d, check-out = +33d (3 nights).
function defaultDates(): { checkIn: string; checkOut: string } {
  const now = new Date();
  const start = new Date(now.getTime() + 30 * 86_400_000);
  const end = new Date(start.getTime() + 3 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(start), checkOut: fmt(end) };
}

const STAY_TYPES: readonly string[] = [
  '',
  'hostel',
  'inn',
  'boutique',
  'hotel',
  'apartment',
  'monthly',
];

export default function StaysPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const initialDates = useMemo(defaultDates, []);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [radiusKm, setRadiusKm] = useState(10);
  const [checkIn, setCheckIn] = useState(initialDates.checkIn);
  const [checkOut, setCheckOut] = useState(initialDates.checkOut);
  const [guests, setGuests] = useState(2);
  const [stayType, setStayType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minWifi, setMinWifi] = useState('');
  const [results, setResults] = useState<readonly StayListingDto[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/stays');
  }, [bootComplete, token, router]);

  const search = useStaysControllerSearch({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as { stays?: readonly StayListingDto[] };
        setResults(body?.stays ?? []);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not search stays.'}`,
        );
      },
    },
  });

  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function runSearch() {
    setErrorMsg(null);
    const data: SearchStaysRequestDto = {
      center: { lat: center.lat, lng: center.lng },
      radiusKm,
      checkIn,
      checkOut,
      guests,
      ...(stayType ? { stayType } : {}),
      ...(maxPrice.trim() && Number(maxPrice) > 0 ? { maxPriceUsdPerNight: Number(maxPrice) } : {}),
      ...(minWifi.trim() && Number(minWifi) > 0 ? { minWifiSpeedMbps: Number(minWifi) } : {}),
    };
    search.mutate({ data });
  }

  // Auto-run once after boot.
  useEffect(() => {
    if (bootComplete && token !== null && results === null && !search.isPending) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token]);

  const sorted = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => {
      const ap = (a.priceUsdPerNight as unknown as number | null) ?? Number.POSITIVE_INFINITY;
      const bp = (b.priceUsdPerNight as unknown as number | null) ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });
  }, [results]);

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
      {/* Cinematic royal header band — matches /home + /trips. */}
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
          Stays
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Find a place to stay near your trip’s centre — filters cover guest count, stay type, a
          price cap, and the nomad-mode wifi floor.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Search</CardTitle>
          <CardSubtitle>
            Centered at {center.lat.toFixed(3)}, {center.lng.toFixed(3)} · {radiusKm} km · {checkIn}{' '}
            → {checkOut}
            {geoStatus === 'pending' ? ' · locating…' : ''}
            {geoStatus === 'denied' ? ' · using default (NYC)' : ''}
          </CardSubtitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button type="button" variant="outline" size="sm" onClick={requestGeolocation}>
            <MapPin aria-hidden className="mr-1.5 h-3.5 w-3.5" />
            {geoStatus === 'granted' ? 'Re-locate' : 'Use my location'}
          </Button>
          <label className="text-xs text-muted">
            Radius (km)
            <input
              type="number"
              min={1}
              max={100}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className={`ml-2 w-20 ${FIELD}`}
            />
          </label>
          <label className="text-xs text-muted">
            Guests
            <input
              type="number"
              min={1}
              max={20}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className={`ml-2 w-16 ${FIELD}`}
            />
          </label>
          <label className="text-xs text-muted">
            Check-in
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={`ml-2 ${FIELD}`}
            />
          </label>
          <label className="text-xs text-muted">
            Check-out
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className={`ml-2 ${FIELD}`}
            />
          </label>
          <label className="text-xs text-muted">
            Type
            <select
              value={stayType}
              onChange={(e) => setStayType(e.target.value)}
              className={`ml-2 ${FIELD}`}
            >
              {STAY_TYPES.map((t) => (
                <option key={t || 'any'} value={t}>
                  {t || 'any'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Max $/night
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="any"
              className={`ml-2 w-20 ${FIELD}`}
            />
          </label>
          <label className="text-xs text-muted">
            Min wifi (Mbps)
            <input
              type="number"
              min={0}
              value={minWifi}
              onChange={(e) => setMinWifi(e.target.value)}
              placeholder="any"
              className={`ml-2 w-20 ${FIELD}`}
            />
          </label>
        </div>
        <div className="mt-4">
          <Button
            type="button"
            variant="royal"
            size="sm"
            onClick={runSearch}
            disabled={search.isPending}
          >
            <Search aria-hidden className="mr-1.5 h-4 w-4" />
            {search.isPending ? 'Searching…' : 'Search stays'}
          </Button>
        </div>
      </Card>

      {errorMsg ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </p>
      ) : null}

      {search.isPending && sorted === null ? (
        <Skeleton className="h-24 rounded-2xl" count={4} />
      ) : sorted === null ? null : sorted.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">
            No stays match. Widen the radius, push the dates, lift the price cap, or drop the wifi
            floor.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sorted.map((s) => (
            <li key={`${s.provider}:${s.externalId}`}>
              <StayRow stay={s} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StayRow({ stay: s }: { stay: StayListingDto }) {
  const price = s.priceUsdPerNight as unknown as number | null;
  const wifi = s.wifiSpeedMbps as unknown as number | null;
  const star = s.starRating as unknown as number | null;
  const distanceKm = (s.distanceMeters / 1000).toFixed(1);
  return (
    <article className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold tracking-tight text-surface-foreground">
            {s.name}
            {star ? <span className="ml-2 text-xs text-gold-500">{'★'.repeat(star)}</span> : null}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {s.stayType} · {distanceKm} km away
            {wifi !== null ? (
              <span className="ml-1 inline-flex items-center gap-1">
                · <Wifi aria-hidden className="h-3 w-3" /> {wifi} Mbps
              </span>
            ) : (
              ''
            )}
          </p>
          {s.amenities.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-1">
              {s.amenities.slice(0, 6).map((a) => (
                <Badge key={a} variant="neutral">
                  {a}
                </Badge>
              ))}
              {s.amenities.length > 6 ? (
                <Badge variant="neutral">+{s.amenities.length - 6}</Badge>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <Badge variant={price !== null ? 'gold' : 'neutral'}>
            {price !== null ? `$${price}/nt` : 'No quote'}
          </Badge>
        </div>
      </div>
    </article>
  );
}
