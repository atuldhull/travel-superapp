/**
 * /weather — standalone weather page.
 *
 * Closes C0's `weather` 20% gap (was in-trip overview only). The api has
 * had `GET /api/v1/weather/forecast` since [V.UX.4] and the hourly
 * adventure-persona variant since [V.UX.21]; this page is the standalone
 * surface that uses both.
 *
 * Geolocation prompt (NYC fallback). Toggle between 7-day daily and
 * 24-hour hourly. The orval Zod-@Query() limitation means we build the
 * URL via `getWeatherControllerForecastUrl()` + `apiFetch` directly —
 * documented exception per [[orval-zod-query-params]].
 *
 * Installed by [S-Cw] of the S-series real-functionality closeout;
 * restyled into the v2 ("Fusion") design language (royal/gold tokens).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudSun, MapPin, RefreshCw } from 'lucide-react';
import {
  apiFetch,
  getWeatherControllerForecastUrl,
  getWeatherControllerHourlyUrl,
  type DailyForecastDto,
  type HourlyForecastDto,
} from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface DailyResponse {
  readonly lat: number;
  readonly lng: number;
  readonly timezone: string;
  readonly days: readonly DailyForecastDto[];
}

interface HourlyResponse {
  readonly lat: number;
  readonly lng: number;
  readonly timezone: string;
  readonly hours: readonly HourlyForecastDto[];
}

const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 };

// Coarse WMO-code → emoji mapping. Keeps the page graphical without
// shipping an icon set. WMO codes: 0 clear, 1-3 mainly clear, 45/48 fog,
// 51-55 drizzle, 61-65 rain, 71-75 snow, 80-82 showers, 95 thunder.
function wmoEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 55) return '🌦️';
  if (code >= 61 && code <= 65) return '🌧️';
  if (code >= 71 && code <= 75) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 95) return '⛈️';
  return '🌥️';
}

export default function WeatherPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [mode, setMode] = useState<'daily' | 'hourly'>('daily');
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [hourly, setHourly] = useState<HourlyResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/weather');
  }, [bootComplete, token, router]);

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

  async function fetchWeather() {
    if (token === null) return;
    setErrorMsg(null);
    setPending(true);
    try {
      if (mode === 'daily') {
        const url = `${getWeatherControllerForecastUrl()}?lat=${center.lat}&lng=${center.lng}&days=7`;
        const res = (await apiFetch(url, { method: 'GET' })) as unknown as { data: DailyResponse };
        setDaily(res.data);
      } else {
        const url = `${getWeatherControllerHourlyUrl()}?lat=${center.lat}&lng=${center.lng}&hours=24`;
        const res = (await apiFetch(url, { method: 'GET' })) as unknown as { data: HourlyResponse };
        setHourly(res.data);
      }
    } catch (err) {
      const e = err as ApiError;
      setErrorMsg(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not fetch weather.'}`,
      );
    } finally {
      setPending(false);
    }
  }

  // Auto-fetch on mount + when center / mode change.
  useEffect(() => {
    if (bootComplete && token !== null) {
      void fetchWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token, mode, center.lat, center.lng]);

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

  const tz = daily?.timezone ?? hourly?.timezone ?? '?';

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <CloudSun aria-hidden className="h-3.5 w-3.5" /> Sky &amp; conditions
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Weather
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          7-day daily or 24-hour hourly forecast for any coordinate — pulled from the same provider
          your trips use (Open-Meteo by default).
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {mode === 'daily' ? '7-day forecast' : '24-hour forecast'}
          </CardTitle>
          <CardSubtitle>
            {center.lat.toFixed(3)}, {center.lng.toFixed(3)} · timezone {tz}
            {geoStatus === 'pending' ? ' · locating…' : ''}
            {geoStatus === 'denied' ? ' · using default (NYC)' : ''}
          </CardSubtitle>
        </CardHeader>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={requestGeolocation}>
            <MapPin aria-hidden className="mr-1.5 h-3.5 w-3.5" />
            {geoStatus === 'granted' ? 'Re-locate' : 'Use my location'}
          </Button>
          <div
            role="tablist"
            aria-label="Forecast mode"
            className="inline-flex gap-1 rounded-full border border-gold-600/20 bg-surface p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'daily'}
              onClick={() => setMode('daily')}
              className={
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                (mode === 'daily'
                  ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300'
                  : 'text-muted hover:text-surface-foreground')
              }
            >
              Daily
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'hourly'}
              onClick={() => setMode('hourly')}
              className={
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                (mode === 'hourly'
                  ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300'
                  : 'text-muted hover:text-surface-foreground')
              }
            >
              Hourly
            </button>
          </div>
          <Button type="button" variant="royal" size="sm" onClick={fetchWeather} disabled={pending}>
            <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
            {pending ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {errorMsg ? (
          <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}

        {pending && !(mode === 'daily' ? daily : hourly) ? (
          <Skeleton className="h-16 rounded-2xl" count={4} />
        ) : mode === 'daily' ? (
          <DailyView data={daily} />
        ) : (
          <HourlyView data={hourly} />
        )}
      </Card>
    </main>
  );
}

function DailyView({ data }: { data: DailyResponse | null }) {
  if (!data) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {data.days.map((d) => {
        const date = new Date(d.date);
        const pop = d.precipitationProbabilityPercent as unknown as number | null;
        return (
          <li
            key={d.date}
            className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)"
          >
            <p className="font-display text-xs font-medium tracking-tight text-muted">
              {date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="mt-1 flex items-baseline gap-2 text-2xl">
              <span aria-hidden>{wmoEmoji(d.weatherCode)}</span>
              <span className="font-display font-semibold text-surface-foreground">
                {Math.round(d.maxTempC)}°
              </span>
              <span className="text-sm text-muted">{Math.round(d.minTempC)}°</span>
            </p>
            {pop !== null ? <p className="mt-1 text-xs text-muted">💧 {pop}%</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function HourlyView({ data }: { data: HourlyResponse | null }) {
  if (!data) return null;
  return (
    <ul className="space-y-2">
      {data.hours.map((h) => {
        const t = new Date(h.time);
        const pop = h.precipitationProbabilityPercent as unknown as number | null;
        const wind = h.windSpeedKmh as unknown as number | null;
        return (
          <li
            key={h.time}
            className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 rounded-2xl border border-gold-600/12 bg-surface px-4 py-2 text-xs shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)"
          >
            <span className="text-muted">
              {t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span aria-hidden className="text-base">
              {wmoEmoji(h.weatherCode)}
            </span>
            <span className="font-display font-semibold text-surface-foreground">
              {Math.round(h.tempC)}°C
            </span>
            <span className="text-muted">{pop !== null ? `💧 ${pop}%` : '—'}</span>
            <span className="text-muted">{wind !== null ? `${Math.round(wind)} km/h` : '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}
