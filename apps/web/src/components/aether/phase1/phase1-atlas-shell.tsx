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
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
} from '@app/aether-core';
import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type ItineraryListResponseDto,
} from '@app/sdk';
import { createAetherPhase1Registry } from './aether-registry';
import { TripDataProvider, type TripDataLike } from './trip-data-context';
import type { AtlasDayLike } from './atlas-orbs';
import { useLifecycleAutoDriver } from './use-lifecycle-driver';

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

  useLifecycleAutoDriver();

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
      <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
        <SurfaceCanvas ariaLabel={`Atlas — ${trip?.title ?? 'loading'}`}>
          <Suspense fallback={null}>
            <ActiveSurfaceMount />
          </Suspense>
        </SurfaceCanvas>
        <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
        <div style={pipStyle} aria-hidden>
          {current?.id ?? '—'} · {trip?.title ?? '…'} · {days.length} day
          {days.length === 1 ? '' : 's'} · audio {audioBridge.status} · drone{' '}
          {audio.drone.toFixed(0)} · events {audio.events.toFixed(0)}
        </div>
      </div>
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
