/**
 * V.UX.21 — "today's adventure window" widget for the adventure /
 * outdoor persona. Browser geolocation → hourly forecast (24h) →
 * scan every consecutive 2-hour pair, score each by precip + wind +
 * temp comfort, surface the best slot.
 *
 * Score per hour (lower is better):
 *   precipPenalty = precipitationProbabilityPercent (0..100)
 *   windPenalty   = max(0, windSpeedKmh - 15) * 2     (calm < 15 km/h is free)
 *   tempPenalty   = abs(tempC - 18) * 1.5              (18°C is the ideal pivot)
 * Slot score = sum of the two hours' per-hour scores. Lowest wins.
 *
 * Anonymous viewers see a compact hint instead of the widget — the
 * api requires auth, and asking for geolocation before sign-in is
 * worse UX than a one-line nudge.
 *
 * Installed by prompt [V.UX.21].
 */
'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type HourlyForecastDto, type HourlyWeatherForecastResponseDto } from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface BestSlot {
  readonly start: HourlyForecastDto;
  readonly end: HourlyForecastDto;
  readonly score: number;
}

const IDEAL_TEMP_C = 18;
const COMFORTABLE_WIND_KMH = 15;

function hourScore(h: HourlyForecastDto): number {
  const precip = (h.precipitationProbabilityPercent as unknown as number | null) ?? 50;
  const wind = (h.windSpeedKmh as unknown as number | null) ?? 0;
  const tempPenalty = Math.abs(h.tempC - IDEAL_TEMP_C) * 1.5;
  const windPenalty = Math.max(0, wind - COMFORTABLE_WIND_KMH) * 2;
  return precip + windPenalty + tempPenalty;
}

function findBestSlot(hours: readonly HourlyForecastDto[]): BestSlot | null {
  if (hours.length < 2) return null;
  let best: BestSlot | null = null;
  for (let i = 0; i < hours.length - 1; i++) {
    const a = hours[i]!;
    const b = hours[i + 1]!;
    const score = hourScore(a) + hourScore(b);
    if (best === null || score < best.score) {
      best = { start: a, end: b, score };
    }
  }
  return best;
}

function formatTime(iso: string): string {
  // Open-Meteo returns local-tz timestamps without an explicit
  // offset (e.g. "2026-09-01T14:00"). Parse as local — close enough
  // for a single-line widget.
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[1]}:${m[2]}`;
}

export function AdventureWindow() {
  const token = useAuthToken();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoErr('Geolocation unavailable on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoErr('Allow location access to surface the best 2-hour slot.'),
      { timeout: 8_000, enableHighAccuracy: false },
    );
  }, [token]);

  // Orval skipped query-param generation for the hourly route (the
  // Zod-validated `@Query()` shape doesn't surface in OpenAPI as
  // typed parameters), so we call apiFetch directly with the URL.
  type HourlyEnvelope = {
    data: HourlyWeatherForecastResponseDto;
    status: number;
    headers: Headers;
  };
  const query = useQuery<HourlyEnvelope>({
    queryKey: ['weather/hourly', coords?.lat, coords?.lng],
    queryFn: () =>
      apiFetch<HourlyEnvelope>(
        `/api/v1/weather/forecast/hourly?lat=${coords!.lat}&lng=${coords!.lng}&hours=24`,
        { method: 'GET' },
      ),
    enabled: token !== null && coords !== null,
    retry: false,
  });

  if (token === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🏔️ Today&apos;s adventure window</CardTitle>
          <CardSubtitle>Sign in to surface the best 2-hour slot near you.</CardSubtitle>
        </CardHeader>
      </Card>
    );
  }

  const apiErr = query.error as ApiError | null;
  const data = query.data?.data;
  const slot = data ? findBestSlot(data.hours) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🏔️ Today&apos;s adventure window</CardTitle>
        <CardSubtitle>
          Best 2-hour slot in the next 24h — scored on precip, wind, and temperature comfort.
        </CardSubtitle>
      </CardHeader>
      {geoErr ? (
        <p className="text-sm text-muted">{geoErr}</p>
      ) : coords === null ? (
        <Skeleton className="h-12 w-full" />
      ) : query.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : query.isError ? (
        <p className="text-sm text-danger">
          Couldn&apos;t load the forecast ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
        </p>
      ) : slot ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <p className="font-semibold">
            🌤️ {formatTime(slot.start.time)} → {formatTime(slot.end.time)}
          </p>
          <ul className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted">
            <li>🌡️ {Math.round((slot.start.tempC + slot.end.tempC) / 2)}°C</li>
            <li>
              🌧️{' '}
              {Math.round(
                (((slot.start.precipitationProbabilityPercent as unknown as number | null) ?? 0) +
                  ((slot.end.precipitationProbabilityPercent as unknown as number | null) ?? 0)) /
                  2,
              )}
              %
            </li>
            <li>
              💨{' '}
              {Math.round(
                (((slot.start.windSpeedKmh as unknown as number | null) ?? 0) +
                  ((slot.end.windSpeedKmh as unknown as number | null) ?? 0)) /
                  2,
              )}{' '}
              km/h
            </li>
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">No clean window in the next 24h — check back later.</p>
      )}
    </Card>
  );
}
