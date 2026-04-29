/**
 * V.UX.19 — hyper-local discovery page for the domestic / day-tripper.
 * "What hidden gems are within driving distance?" — geolocation +
 * a 25..300km slider + the gem-zone backend (5..50 reviews, sorted
 * by avg rating).
 *
 * Auth-gated: the api requires a bearer; an anonymous visitor is
 * bounced to /login.
 *
 * Installed by prompt [V.UX.19].
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🗺️ Hidden gems near you</CardTitle>
          <CardSubtitle>
            Within driving distance — places with enough reviews to be trusted, but not so many
            they're tourist traps (5–50 reviews, sorted by rating).
          </CardSubtitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={locate} disabled={busy}>
              {busy ? '📍 Locating…' : coords ? '📍 Update location' : '📍 Use my location'}
            </Button>
            {coords ? (
              <span className="font-mono text-xs text-muted">
                {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              </span>
            ) : null}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between">
              <span>Day-trip distance</span>
              <span className="font-mono text-muted">{radiusKm} km</span>
            </span>
            <input
              type="range"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="accent-brand"
              aria-label="Day-trip distance in kilometres"
            />
            <span className="flex justify-between text-[10px] text-muted/70">
              <span>{MIN_RADIUS_KM} km</span>
              <span>{MAX_RADIUS_KM} km</span>
            </span>
          </label>
          <Button onClick={search} disabled={!coords || mutation.isPending}>
            {mutation.isPending ? 'Searching…' : '✨ Find hidden gems'}
          </Button>
        </div>
      </Card>

      {errMsg ? (
        <Card>
          <p className="text-sm text-danger">{errMsg}</p>
        </Card>
      ) : null}

      {gems !== null ? (
        gems.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No gems within {radiusKm} km yet — try widening the slider, or check back as more
              local reviews come in.
            </p>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Within driving distance</CardTitle>
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
