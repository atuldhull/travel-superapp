/**
 * /transport — compare modes between two points.
 *
 * Closes C0's `transport` 0% gap. The `/api/v1/transport/routes`
 * endpoint has been wired since [V.UX.15] (accessibility step-free
 * filter); this page is the standalone surface that uses it.
 *
 * Origin defaults to the user's geolocation when allowed; destination
 * is free-form lat/lng (geocoder is a follow-up — keep this slice
 * tight). Renders one card per mode with distance / duration / cost /
 * confidence + accessibility badge.
 *
 * Installed by [S-Ct] of the S-series real-functionality closeout.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTransportControllerRoutes, type GetRoutesRequestDto, type RouteLegDto } from '@app/sdk';

// Mirror of the SDK schema enum const (orval emits the value as a
// `*const` object but the barrel only re-exports types, so we declare
// the union locally — same pattern as /reviews/new).
type TransportMode =
  | 'walk'
  | 'public_transit'
  | 'bicycle'
  | 'two_wheeler'
  | 'car'
  | 'taxi'
  | 'rideshare';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const DEFAULT_ORIGIN = { lat: 40.758, lng: -73.9855 }; // Times Square
const DEFAULT_DEST = { lat: 40.7484, lng: -73.9857 }; // Empire State (default short hop)

const MODE_LABELS: Record<TransportMode, string> = {
  walk: '🚶 Walk',
  public_transit: '🚇 Transit',
  bicycle: '🚲 Bike',
  two_wheeler: '🛵 Scooter',
  car: '🚗 Car',
  taxi: '🚕 Taxi',
  rideshare: '🚙 Rideshare',
};

const ALL_MODES: readonly TransportMode[] = [
  'walk',
  'public_transit',
  'bicycle',
  'two_wheeler',
  'car',
  'taxi',
  'rideshare',
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const restMin = mins % 60;
  return restMin === 0 ? `${hours}h` : `${hours}h ${restMin}m`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function TransportPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [, setOrigin] = useState(DEFAULT_ORIGIN);
  const [, setDestination] = useState(DEFAULT_DEST);
  const [originText, setOriginText] = useState(`${DEFAULT_ORIGIN.lat}, ${DEFAULT_ORIGIN.lng}`);
  const [destText, setDestText] = useState(`${DEFAULT_DEST.lat}, ${DEFAULT_DEST.lng}`);
  const [selectedModes, setSelectedModes] = useState<Set<TransportMode>>(() => new Set(ALL_MODES));
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [results, setResults] = useState<readonly RouteLegDto[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/transport');
  }, [bootComplete, token, router]);

  const search = useTransportControllerRoutes({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as { routes?: readonly RouteLegDto[] };
        setResults(body?.routes ?? []);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not compute routes.'}`,
        );
      },
    },
  });

  function parseLatLng(s: string): { lat: number; lng: number } | null {
    const parts = s.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
    const [lat, lng] = parts;
    if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) return null;
    return { lat: lat!, lng: lng! };
  }

  function useMyLocationAsOrigin() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newO = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(newO);
        setOriginText(`${newO.lat.toFixed(5)}, ${newO.lng.toFixed(5)}`);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function runSearch() {
    setErrorMsg(null);
    const parsedO = parseLatLng(originText);
    const parsedD = parseLatLng(destText);
    if (!parsedO || !parsedD) {
      setErrorMsg('Origin and destination must be "lat, lng" pairs (e.g. "40.758, -73.9855").');
      return;
    }
    setOrigin(parsedO);
    setDestination(parsedD);
    const modes = Array.from(selectedModes);
    const data: GetRoutesRequestDto = {
      origin: parsedO,
      destination: parsedD,
      ...(modes.length > 0 && modes.length < ALL_MODES.length ? { modes } : {}),
      ...(stepFreeOnly ? { stepFreeOnly: true } : {}),
    };
    search.mutate({ data });
  }

  function toggleMode(m: TransportMode) {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  // Auto-run on first boot with the defaults so the page demos meaningfully.
  useEffect(() => {
    if (bootComplete && token !== null && results === null && !search.isPending) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token]);

  const sorted = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => a.durationSeconds - b.durationSeconds);
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
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">How to get there</h1>
        <p className="text-sm text-muted">
          Compare walk / transit / bike / car / taxi side-by-side between two coordinates. V.UX.15
          step-free filter for accessibility.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardSubtitle>Free-form `lat, lng` pairs. Geocoder is a follow-up.</CardSubtitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Origin
            <input
              type="text"
              value={originText}
              onChange={(e) => setOriginText(e.target.value)}
              placeholder="40.758, -73.9855"
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm font-mono"
            />
            <button
              type="button"
              onClick={useMyLocationAsOrigin}
              className="mt-1 text-xs text-brand hover:underline"
            >
              📍 Use my location
            </button>
          </label>
          <label className="text-xs text-muted">
            Destination
            <input
              type="text"
              value={destText}
              onChange={(e) => setDestText(e.target.value)}
              placeholder="40.7484, -73.9857"
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm font-mono"
            />
          </label>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted">Modes</p>
          <div className="flex flex-wrap gap-1">
            {ALL_MODES.map((m) => {
              const active = selectedModes.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMode(m)}
                  aria-pressed={active}
                  className={
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition ' +
                    (active
                      ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 dark:text-gold-300'
                      : 'border-muted/30 text-muted hover:bg-muted/5')
                  }
                >
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={stepFreeOnly}
              onChange={(e) => setStepFreeOnly(e.target.checked)}
              className="accent-gold-600"
            />
            Step-free only (accessibility)
          </label>
          <Button type="button" size="sm" onClick={runSearch} disabled={search.isPending}>
            {search.isPending ? 'Routing…' : 'Compare routes'}
          </Button>
        </div>
      </Card>

      {errorMsg ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </p>
      ) : null}

      {search.isPending && sorted === null ? (
        <Skeleton className="h-16" count={4} />
      ) : sorted === null ? null : sorted.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No routes available between those points with the selected modes. Try widening the mode
            set or clear the step-free filter.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sorted.map((r) => (
            <li key={r.mode}>
              <RouteCard route={r} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function RouteCard({ route: r }: { route: RouteLegDto }) {
  const cost = r.estimatedCostUsd as unknown as number | null;
  const confidence = r.confidence as unknown as number;
  return (
    <article className="rounded-md border border-muted/15 bg-surface p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{MODE_LABELS[r.mode as TransportMode] ?? r.mode}</h3>
        {r.stepFree ? <Badge variant="brand">♿ step-free</Badge> : null}
      </header>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Distance</dt>
        <dd className="text-right font-medium">{formatDistance(r.distanceMeters)}</dd>
        <dt className="text-muted">Duration</dt>
        <dd className="text-right font-medium">{formatDuration(r.durationSeconds)}</dd>
        <dt className="text-muted">Est. cost</dt>
        <dd className="text-right font-medium">{cost === null ? '—' : `$${cost.toFixed(2)}`}</dd>
        <dt className="text-muted">Confidence</dt>
        <dd className="text-right text-muted">{(confidence * 100).toFixed(0)}%</dd>
      </dl>
    </article>
  );
}
