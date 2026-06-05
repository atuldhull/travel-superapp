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
 * Installed by [S-Ct] of the S-series real-functionality closeout;
 * restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band).
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Accessibility, MapPin, Navigation, Route } from 'lucide-react';
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
import { useAuthBootComplete } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const DEFAULT_ORIGIN = { lat: 40.758, lng: -73.9855 }; // Times Square
const DEFAULT_DEST = { lat: 40.7484, lng: -73.9857 }; // Empire State (default short hop)

// Shared field styling so the two endpoint inputs read as one set.
const FIELD =
  'mt-1.5 w-full rounded-xl border border-gold-600/25 bg-surface px-3.5 py-2.5 font-mono text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

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
  // Public surface — route comparison is browsable without an account
  // (the /transport/routes endpoint is @Public).
  const bootComplete = useAuthBootComplete();
  const [, setOrigin] = useState(DEFAULT_ORIGIN);
  const [, setDestination] = useState(DEFAULT_DEST);
  const [originText, setOriginText] = useState(`${DEFAULT_ORIGIN.lat}, ${DEFAULT_ORIGIN.lng}`);
  const [destText, setDestText] = useState(`${DEFAULT_DEST.lat}, ${DEFAULT_DEST.lng}`);
  const [selectedModes, setSelectedModes] = useState<Set<TransportMode>>(() => new Set(ALL_MODES));
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [results, setResults] = useState<readonly RouteLegDto[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (bootComplete && results === null && !search.isPending) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete]);

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
          <Route aria-hidden className="h-3.5 w-3.5" /> Getting around
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          How to get there
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Compare walk, transit, bike, car &amp; taxi side-by-side between two coordinates — with a
          step-free filter for accessibility.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardSubtitle>Free-form `lat, lng` pairs. Geocoder is a follow-up.</CardSubtitle>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted">
            Origin
            <input
              type="text"
              value={originText}
              onChange={(e) => setOriginText(e.target.value)}
              placeholder="40.758, -73.9855"
              className={FIELD}
            />
            <button
              type="button"
              onClick={useMyLocationAsOrigin}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full text-xs font-medium text-gold-600 underline-offset-4 transition hover:text-gold-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
            >
              <MapPin aria-hidden className="h-3.5 w-3.5" /> Use my location
            </button>
          </label>
          <label className="block text-xs font-medium text-muted">
            Destination
            <input
              type="text"
              value={destText}
              onChange={(e) => setDestText(e.target.value)}
              placeholder="40.7484, -73.9857"
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Modes</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_MODES.map((m) => {
              const active = selectedModes.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMode(m)}
                  aria-pressed={active}
                  className={
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                    (active
                      ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 dark:text-gold-300'
                      : 'border-gold-600/20 text-muted hover:border-gold-600/35 hover:bg-gold-500/5')
                  }
                >
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={stepFreeOnly}
              onChange={(e) => setStepFreeOnly(e.target.checked)}
              className="accent-gold-600"
            />
            <Accessibility aria-hidden className="h-3.5 w-3.5 text-gold-600 dark:text-gold-300" />
            Step-free only (accessibility)
          </label>
          <Button
            type="button"
            variant="royal"
            size="sm"
            onClick={runSearch}
            disabled={search.isPending}
          >
            <Navigation aria-hidden className="h-3.5 w-3.5" />
            {search.isPending ? 'Routing…' : 'Compare routes'}
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
        <Card depth="flat">
          <p className="text-sm text-muted">
            No routes available between those points with the selected modes. Try widening the mode
            set or clear the step-free filter.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
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
    <article className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight text-surface-foreground">
          {MODE_LABELS[r.mode as TransportMode] ?? r.mode}
        </h3>
        {r.stepFree ? <Badge variant="gold">♿ step-free</Badge> : null}
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">Distance</dt>
        <dd className="text-right font-medium text-surface-foreground">
          {formatDistance(r.distanceMeters)}
        </dd>
        <dt className="text-muted">Duration</dt>
        <dd className="text-right font-medium text-surface-foreground">
          {formatDuration(r.durationSeconds)}
        </dd>
        <dt className="text-muted">Est. cost</dt>
        <dd className="text-right font-medium text-surface-foreground">
          {cost === null ? '—' : `$${cost.toFixed(2)}`}
        </dd>
        <dt className="text-muted">Confidence</dt>
        <dd className="text-right text-muted">{(confidence * 100).toFixed(0)}%</dd>
      </dl>
    </article>
  );
}
