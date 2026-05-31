'use client';

/**
 * AE395 — `useRealWeather()` React hook.
 *
 * Fetches Open-Meteo for a (coords, date) pair and returns the
 * resolved `WeatherState` (or null while pending / on error). The
 * Atlas shell composes this with AE388's simulation: real weather
 * when available, simulation as the fallback.
 *
 * No react-query here — Open-Meteo is a pure external API and the
 * Phase 1 Atlas shell mounts once per trip, so a plain useEffect +
 * AbortController fits the lifecycle without dragging the SDK's
 * query-client into the canvas tree.
 */
import { useEffect, useState } from 'react';
import { openMeteoUrl, parseOpenMeteoDaily } from './open-meteo';
import type { DestinationCoords } from './destination-coords';
import type { WeatherState } from './weather-simulation';

export interface UseRealWeatherResult {
  /** The resolved weather state, or null when pending / fallback. */
  readonly weather: WeatherState | null;
  /** True while the fetch is in flight. */
  readonly isPending: boolean;
  /** True when the fetch failed (caller should fall back to AE388). */
  readonly isError: boolean;
}

/** Read real weather for the trip's coords + start date. Returns
 *  `{weather: null}` when coords / date are absent so the caller can
 *  short-circuit to simulation without touching the network.
 *
 *  Cancels in-flight requests on unmount + on input change. */
export function useRealWeather(
  coords: DestinationCoords | null | undefined,
  date: Date | string | null | undefined,
): UseRealWeatherResult {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [isPending, setPending] = useState<boolean>(false);
  const [isError, setError] = useState<boolean>(false);

  useEffect(() => {
    if (coords === null || coords === undefined || date === null || date === undefined) {
      setWeather(null);
      setPending(false);
      setError(false);
      return undefined;
    }
    const url = openMeteoUrl(coords, date);
    if (url === null) {
      setWeather(null);
      setPending(false);
      setError(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setPending(true);
    setError(false);
    (async (): Promise<void> => {
      try {
        const resp = await fetch(url, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (ctrl.signal.aborted) return;
        setWeather(parseOpenMeteoDaily(json));
        setPending(false);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        // Network / parse failure — caller falls back to simulation.
        if (
          err !== null &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name: string }).name === 'AbortError'
        ) {
          return;
        }
        setError(true);
        setPending(false);
      }
    })();
    return (): void => {
      ctrl.abort();
    };
  }, [coords?.lat, coords?.lng, typeof date === 'string' ? date : date?.toISOString()]);

  return { weather, isPending, isError };
}
