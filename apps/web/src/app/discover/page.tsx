/**
 * V.UX.19 — hyper-local discovery page for the domestic / day-tripper.
 * "What hidden gems are within driving distance?" — geolocation +
 * a 25..300km slider + the gem-zone backend (5..50 reviews, sorted
 * by avg rating).
 *
 * Auth-gated: the api requires a bearer; an anonymous visitor is
 * bounced to /login.
 *
 * Installed by prompt [V.UX.19]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display).
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Gem, MapPin, Sparkles } from 'lucide-react';
import {
  usePlacesControllerHiddenGems,
  type DiscoverHiddenGemsRequestDto,
  type DiscoverHiddenGemsResponseDto,
  type HiddenGemDto,
} from '@app/sdk';
import { GemCard } from '../../components/discover/gem-card';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const DEFAULT_RADIUS_KM = 100;
const MIN_RADIUS_KM = 25;
const MAX_RADIUS_KM = 300;

export default function DiscoverPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [gems, setGems] = useState<HiddenGemDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const mutation = usePlacesControllerHiddenGems({
    mutation: {
      onSuccess: (resp: { data?: unknown }) => {
        const body = resp.data as DiscoverHiddenGemsResponseDto;
        setGems(body.gems);
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Discovery failed.'}`);
        setGems(null);
      },
    },
  });

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrMsg('Geolocation unavailable — try a desktop browser.');
      return;
    }
    setBusy(true);
    setErrMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setBusy(false);
      },
      (err) => {
        setErrMsg(`Couldn't get your location (${err.code}). Allow access and retry.`);
        setBusy(false);
      },
      { timeout: 10_000, enableHighAccuracy: false },
    );
  }

  function search() {
    if (!coords) return;
    const data: DiscoverHiddenGemsRequestDto = {
      center: coords,
      radiusKm,
      limit: 24,
    };
    mutation.mutate({ data });
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
          <Gem aria-hidden className="h-3.5 w-3.5" /> Hidden gems
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Discover near you
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Within driving distance — places with enough reviews to be trusted, but not so many
          they’re tourist traps (5–50 reviews, sorted by rating).
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Find gems within driving distance</CardTitle>
          <CardSubtitle>
            Share your location, set how far you’re willing to drive, and we’ll surface the
            best-rated under-the-radar spots.
          </CardSubtitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={locate} disabled={busy}>
              <MapPin aria-hidden className="mr-1.5 h-4 w-4" />
              {busy ? 'Locating…' : coords ? 'Update location' : 'Use my location'}
            </Button>
            {coords ? (
              <span className="font-mono text-xs text-muted">
                {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              </span>
            ) : null}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span className="text-muted">Day-trip distance</span>
              <span className="font-mono font-semibold text-gold-600 dark:text-gold-400">
                {radiusKm} km
              </span>
            </span>
            <input
              type="range"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="accent-gold-600"
              aria-label="Day-trip distance in kilometres"
            />
            <span className="flex justify-between text-[10px] text-muted/70">
              <span>{MIN_RADIUS_KM} km</span>
              <span>{MAX_RADIUS_KM} km</span>
            </span>
          </label>
          <div>
            <Button variant="royal" onClick={search} disabled={!coords || mutation.isPending}>
              <Sparkles aria-hidden className="mr-1.5 h-4 w-4" />
              {mutation.isPending ? 'Searching…' : 'Find hidden gems'}
            </Button>
          </div>
        </div>
      </Card>

      {errMsg ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}

      {gems !== null ? (
        gems.length === 0 ? (
          <Card depth="flat" className="p-5">
            <p className="text-sm text-muted">
              No gems within {radiusKm} km yet — try widening the slider, or check back as more
              local reviews come in.
            </p>
          </Card>
        ) : (
          <Card depth="raised">
            <CardHeader>
              <CardTitle className="font-display text-xl">Within driving distance</CardTitle>
              <CardSubtitle>
                {gems.length} gem{gems.length === 1 ? '' : 's'} sorted by rating.
              </CardSubtitle>
            </CardHeader>
            <ul className="space-y-2">
              {gems.map((g) => (
                <GemCard key={g.id} gem={g} />
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </main>
  );
}
