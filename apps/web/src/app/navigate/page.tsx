/**
 * /navigate — the premium Live Navigation surface.
 *
 * Pick (or GPS-detect) a journey and the map draws real road routes
 * with live(ish) traffic colouring, a travelling gold pulse, ETA
 * cards, and reroute advisories. Powered by
 * `POST /api/v1/transport/navigation` (OSRM $0 base + optional TomTom
 * live traffic; deterministic mock fallback so it never looks broken
 * — see the API-offline state mirrors /featured).
 *
 * apiFetch-direct via lib/two-oh-api (2.0 SDK regen is a deferred
 * seam). Auth-gated like the other data surfaces; the map component
 * is loaded ssr:false (Leaflet touches `window`).
 *
 * Installed for the live-navigation feature.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { getNavigation, type NavPoint, type NavRouteSet } from '../../lib/two-oh-api';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CloudOff,
  Crosshair,
  Gauge,
  MapPinned,
  Mountain,
  Navigation,
  OctagonAlert,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { SkeletonCard } from '../../components/ui/skeleton';

const LiveNavMap = dynamic(
  () => import('../../components/nav/live-nav-map').then((m) => m.LiveNavMap),
  {
    ssr: false,
    loading: () => <div className="h-[460px] w-full animate-pulse rounded-2xl bg-gold-500/5" />,
  },
);

interface Preset {
  readonly label: string;
  readonly hint: string;
  readonly origin: NavPoint;
  readonly destination: NavPoint;
}

// Famous Indian road journeys — instant gratification, no typing.
const PRESETS: readonly Preset[] = [
  {
    label: 'Delhi → Jaipur',
    hint: 'Golden Triangle highway',
    origin: { lat: 28.6139, lng: 77.209 },
    destination: { lat: 26.9124, lng: 75.7873 },
  },
  {
    label: 'Manali → Leh',
    hint: 'High-altitude adventure',
    origin: { lat: 32.2396, lng: 77.1887 },
    destination: { lat: 34.1526, lng: 77.5771 },
  },
  {
    label: 'Mumbai → Pune',
    hint: 'Expressway ghats',
    origin: { lat: 19.076, lng: 72.8777 },
    destination: { lat: 18.5204, lng: 73.8567 },
  },
  {
    label: 'Bengaluru → Mysuru',
    hint: 'Palace road trip',
    origin: { lat: 12.9716, lng: 77.5946 },
    destination: { lat: 12.2958, lng: 76.6394 },
  },
];

const FLAVOR_META = {
  fastest: { icon: Gauge, tint: 'gold' as const },
  scenic: { icon: Mountain, tint: 'success' as const },
  avoid_traffic: { icon: RouteIcon, tint: 'brand' as const },
};

const ADVISORY_META = {
  blockage: { icon: OctagonAlert, cls: 'text-red-500' },
  reroute: { icon: Navigation, cls: 'text-gold-600 dark:text-gold-300' },
  heavy_traffic: { icon: TriangleAlert, cls: 'text-orange-500' },
  scenic_tip: { icon: Sparkles, cls: 'text-emerald-500' },
};

function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)} km` : `${m} m`;
}
function fmtDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function NavigatePage() {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const reduce = useReducedMotion();

  const [presetIdx, setPresetIdx] = useState(0);
  const [origin, setOrigin] = useState<NavPoint>(PRESETS[0]!.origin);
  const [destination, setDestination] = useState<NavPoint>(PRESETS[0]!.destination);
  const [data, setData] = useState<NavRouteSet | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveLoc, setLiveLoc] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  const load = useCallback(async (o: NavPoint, d: NavPoint) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNavigation({ origin: o, destination: d });
      setData(res);
      setSelectedId(res.recommendedRouteId);
    } catch {
      setError('offline');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootComplete && token) void load(origin, destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token]);

  const choosePreset = (i: number) => {
    const p = PRESETS[i]!;
    setPresetIdx(i);
    setOrigin(p.origin);
    setDestination(p.destination);
    void load(p.origin, p.destination);
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o: NavPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(o);
        setLiveLoc(true);
        setGpsBusy(false);
        void load(o, destination);
      },
      () => setGpsBusy(false),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const selected = useMemo(
    () => data?.routes.find((r) => r.id === selectedId) ?? data?.routes[0] ?? null,
    [data, selectedId],
  );

  return (
    <main className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-12 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-[120px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Navigation aria-hidden className="h-3.5 w-3.5" /> Live Navigation
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Know the road before you take it
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Real road routes, live traffic, and a smarter alternative the moment a road is blocked —
          pick a journey or navigate from where you stand.
        </p>
      </header>

      {/* Journey picker */}
      <section className="flex flex-wrap items-center gap-2.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => choosePreset(i)}
            aria-pressed={presetIdx === i && !loading}
            className={
              'group rounded-2xl border px-4 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
              (presetIdx === i
                ? 'border-gold-600/40 bg-gold-500/10 shadow-(--shadow-depth-1)'
                : 'border-gold-600/15 bg-surface hover:border-gold-600/30 hover:bg-gold-500/5')
            }
          >
            <span className="flex items-center gap-2 text-sm font-medium text-surface-foreground">
              <MapPinned aria-hidden className="h-4 w-4 text-gold-600" />
              {p.label}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{p.hint}</span>
          </button>
        ))}
        <Button
          type="button"
          variant="royal"
          onClick={useMyLocation}
          disabled={gpsBusy}
          className="ml-auto"
        >
          <Crosshair aria-hidden className="mr-1.5 h-4 w-4" />
          {gpsBusy ? 'Locating…' : 'Use my location'}
        </Button>
      </section>

      {!bootComplete || (loading && !data) ? (
        <SkeletonCard count={1} />
      ) : !token ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <ShieldAlert aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            Sign in to navigate
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Live navigation is a member surface.{' '}
            <Link href="/login" className="text-gold-600 underline-offset-4 hover:underline">
              Sign in
            </Link>{' '}
            to plot a route.
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <CloudOff aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            The navigator is offline
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            We couldn&apos;t reach the routing API. Once it&apos;s running the map and live routes
            appear here.
          </p>
          <Button variant="royal" onClick={() => load(origin, destination)} className="mt-1">
            Try again
          </Button>
        </div>
      ) : data && selected ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <LiveNavMap
              routes={data.routes}
              selectedRouteId={selected.id}
              recommendedRouteId={data.recommendedRouteId}
              onSelectRoute={setSelectedId}
              showLiveLocation={liveLoc}
              className="h-[460px] w-full"
            />
            {/* Traffic legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              {(
                [
                  ['Free', '#15b371'],
                  ['Moderate', '#d99a2b'],
                  ['Heavy', '#e8702a'],
                  ['Blocked', '#dc2626'],
                ] as const
              ).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-5 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                  {k}
                </span>
              ))}
              <span className="ml-auto inline-flex items-center gap-1.5">
                Traffic:{' '}
                <Badge variant={data.routes[0]?.trafficSource === 'live' ? 'success' : 'neutral'}>
                  {data.routes[0]?.trafficSource === 'live' ? 'Live' : 'Estimated'}
                </Badge>
              </span>
            </div>
          </motion.div>

          {/* Route options + advisories */}
          <aside className="space-y-3">
            {data.routes.map((r) => {
              const meta = FLAVOR_META[r.flavor];
              const Icon = meta.icon;
              const isSel = r.id === selected.id;
              const isRec = r.id === data.recommendedRouteId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  aria-pressed={isSel}
                  className={
                    'w-full rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                    (isSel
                      ? 'border-gold-600/45 bg-gold-500/10 shadow-(--shadow-depth-2)'
                      : 'border-gold-600/15 bg-surface hover:border-gold-600/30 hover:shadow-(--shadow-depth-1)')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight text-surface-foreground">
                      <Icon aria-hidden className="h-4 w-4 text-gold-600" />
                      {r.label}
                    </span>
                    {isRec && <Badge variant="gold">Recommended</Badge>}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="font-medium text-surface-foreground">
                      {fmtDur(r.durationInTrafficSeconds)}
                    </span>
                    <span className="text-muted">{fmtKm(r.distanceMeters)}</span>
                    {r.durationInTrafficSeconds > r.durationSeconds && (
                      <span className="text-xs text-orange-500">
                        +{fmtDur(r.durationInTrafficSeconds - r.durationSeconds)} traffic
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {selected.advisories.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-gold-600/15 bg-surface p-4 shadow-(--shadow-depth-1)">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  On this route
                </p>
                {selected.advisories.map((a, i) => {
                  const m = ADVISORY_META[a.kind];
                  const Icon = m.icon;
                  return (
                    <p key={i} className="flex items-start gap-2 text-sm text-surface-foreground">
                      <Icon aria-hidden className={'mt-0.5 h-4 w-4 shrink-0 ' + m.cls} />
                      {a.message}
                    </p>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
