'use client';

/**
 * Phase 1 Atlas shell — `/aether/journey/:id` replacement (behind
 * `NEXT_PUBLIC_FEATURE_AETHER_PHASE1`).
 *
 * Wires:
 *   1. `useTripControllerGetOne(tripId)` + `useTripControllerGetItinerary(tripId)`
 *      from `@app/sdk`. Both are React Query hooks, so the SurfaceManagerProvider
 *      + AetherProvider trees stay clean.
 *   2. `<TripDataProvider>` flows the trip + days into the scene.
 *   3. `<SurfaceManagerProvider>` registry includes the atlas surface
 *      (the registry is shared with the Drift shell — registries are pure
 *      data, so re-creating one here is cheap).
 *   4. `<SurfaceCanvas>` mounts the lazy scene (`atlas-phase1-scene.tsx`).
 *   5. `<SurfaceAudioLayer>` mounts the audio layer; the Atlas key
 *      signature comes from the registered surface (currently 'leh' —
 *      C minor pentatonic).
 *
 * Pulls the same lifecycle auto-driver pattern as Phase1DriftShell so
 * the camera + audio fade through materialise → settle → listen on mount.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { SurfaceAudioLayer, useSceneAudioBridge } from '@app/aether-audio';
import { SurfaceCanvas } from '@app/aether-canvas';
import {
  SurfaceManagerProvider,
  SurfacePaletteOverride,
  SurfacePaletteVars,
  extractDestinationSlugFromTitle,
  paletteForDestination,
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
  type SurfacePalette,
} from '@app/aether-core';
import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type ItineraryListResponseDto,
} from '@app/sdk';
import { createAetherPhase1Registry } from './aether-registry';
import { Phase1ContinuumBar } from './phase1-continuum-bar';
import { Phase1ContinuumReceiverToast } from './phase1-continuum-receiver-toast';
import { Phase1DevNav } from './phase1-dev-nav';
import { Phase1PulseOverlay } from './phase1-pulse-overlay';
import { TripDataProvider, type TripDataLike } from './trip-data-context';
import type { AtlasDayLike } from './atlas-orbs';
import { BREATHING_LIFECYCLE_PLAN, useLifecycleAutoDriver } from './use-lifecycle-driver';
import { WeatherProvider } from './weather-context';
import { simulatedWeatherFor, type WeatherState } from './weather-simulation';

export interface Phase1AtlasShellProps {
  readonly tripId: string;
}

export function Phase1AtlasShell({ tripId }: Phase1AtlasShellProps): React.ReactElement {
  // Same memo pattern as Phase1DriftShell — registries are mutable in
  // theory, so we pin one across re-renders.
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname =
    typeof window === 'undefined' ? `/aether/journey/${tripId}` : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <Phase1AtlasInner tripId={tripId} />
    </SurfaceManagerProvider>
  );
}

function Phase1AtlasInner({ tripId }: { tripId: string }): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') setRoute(pathname);
  }, [pathname, setRoute]);

  // AE382 — looping plan; closes the lifecycle so the dissolve fade
  // (camera pull-back + drone fade-down) plays out before the next cycle.
  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

  const tripQuery = useTripControllerGetOne(tripId);
  const itineraryQuery = useTripControllerGetItinerary(tripId);

  // Normalise the orval/`@ts-nocheck` SDK shapes into the
  // TripDataProvider's stable contract.
  const trip = useMemo<TripDataLike | null>(() => {
    const raw = tripQuery.data?.data;
    if (raw === undefined || raw === null) return null;
    return {
      id: raw.id,
      title: raw.title,
      status: raw.status,
      startsOn: raw.startsOn ?? null,
      endsOn: raw.endsOn ?? null,
    };
  }, [tripQuery.data]);

  const days = useMemo<ReadonlyArray<AtlasDayLike>>(() => {
    // Orval schemas ship `@ts-nocheck` so the inner `.data` shape needs
    // an explicit cast to the typed response; same trick the editorial
    // journey-dashboard uses.
    const envelope = itineraryQuery.data?.data as ItineraryListResponseDto | undefined;
    if (envelope === undefined) return [];
    return envelope.days.map((d: ItineraryDayDto) => ({
      id: d.id,
      dayIndex: d.dayIndex,
      date: d.date,
      items: d.items.map((it: ItineraryItemDto) => ({
        id: it.id,
        position: it.position,
        // Orval emits placeId as `{ [k: string]: unknown } | null`
        // because of a slightly under-specified OpenAPI fragment; the
        // runtime value is always a UUID string or null. Coerce here
        // rather than fix the schema (single consumer for now).
        placeId: typeof it.placeId === 'string' ? it.placeId : null,
      })),
    }));
  }, [itineraryQuery.data]);

  const isPending = tripQuery.isPending || itineraryQuery.isPending;
  const isError = tripQuery.isError || itineraryQuery.isError;

  // AE384 — derive a palette from the trip's destination. The title is
  // the cheapest signal we have today ("Five days in Leh" → 'leh');
  // later slices can layer in primary-place lookup via placeId.
  const tripPaletteOverride = useMemo<SurfacePalette | null>(() => {
    const slug = extractDestinationSlugFromTitle(trip?.title);
    if (slug === null) return null;
    return paletteForDestination(slug);
  }, [trip?.title]);

  // AE388 — simulated weather for the trip. Slug derived from title;
  // date from the trip's startsOn (or "now" if absent). Empty / unknown
  // slugs return 'clear' so the streaks stay off.
  const simulatedWeather = useMemo<WeatherState>(() => {
    const slug = extractDestinationSlugFromTitle(trip?.title);
    const at = trip?.startsOn ?? new Date();
    return simulatedWeatherFor(slug, at);
  }, [trip?.title, trip?.startsOn]);

  // Same dev-only operator pip as the Drift shell.
  const [audio, setAudio] = useState<{ drone: number; events: number }>({
    drone: -60,
    events: -60,
  });
  const audioBridge = useSceneAudioBridge(setAudio);
  const isDev = process.env.NODE_ENV !== 'production';
  const pipStyle: CSSProperties = {
    position: 'fixed',
    top: 12,
    left: 12,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.55)',
    color: '#F2E8D5',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    zIndex: 10,
    display: isDev ? 'block' : 'none',
  };

  return (
    <TripDataProvider trip={trip} days={days} isPending={isPending} isError={isError}>
      <SurfacePaletteOverride palette={tripPaletteOverride}>
        <WeatherProvider weather={simulatedWeather}>
          <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
            <SurfacePaletteVars />
            <SurfaceCanvas ariaLabel={`Atlas — ${trip?.title ?? 'loading'}`}>
              <Suspense fallback={null}>
                <ActiveSurfaceMount />
              </Suspense>
            </SurfaceCanvas>
            <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
            <Phase1DevNav />
            {/* AE389 — always-present Pulse 60px corner glow. */}
            <Phase1PulseOverlay />
            {/* AE390 — Continuum cross-device handoff bar. The active
                trip id rides as a handoff extra so the receiver can
                deep-link directly back into the same journey. */}
            <Phase1ContinuumBar extras={{ trip: tripId }} />
            {/* AE391 — receiver toast for inbound handoffs. */}
            <Phase1ContinuumReceiverToast />
            <div style={pipStyle} aria-hidden>
              {current?.id ?? '—'} · {trip?.title ?? '…'} · {days.length} day
              {days.length === 1 ? '' : 's'} · weather {simulatedWeather} · audio{' '}
              {audioBridge.status} · drone {audio.drone.toFixed(0)} · events{' '}
              {audio.events.toFixed(0)}
            </div>
          </div>
        </WeatherProvider>
      </SurfacePaletteOverride>
    </TripDataProvider>
  );
}

/** Same pattern as Phase1DriftShell — resolve the active Surface's
 *  lazy mount and render it inside the canvas. Returns null when the
 *  surface has no mount loader (e.g. a placeholder route in the
 *  registry). */
function ActiveSurfaceMount(): React.ReactElement | null {
  const current = useCurrentSurface();
  const phase = useSurfaceManager().phase;
  const Lazy = useMemo(() => {
    if (current === null || current.mount === undefined) return null;
    return lazy(
      current.mount as () => Promise<{ default: React.ComponentType<SurfaceMountProps> }>,
    );
  }, [current]);
  if (Lazy === null || current === null) return null;
  return <Lazy surface={current} phase={phase} />;
}
