'use client';

/**
 * Phase 1 Compass shell — `/aether/atlas` replacement when
 * `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`.
 *
 * Same wiring shape as Phase1DriftShell and Phase1AtlasShell:
 *   1. <SurfaceManagerProvider> with the shared Phase 1 registry
 *   2. <CompassBearingProvider> — Phase 1 first cut uses constant 0°
 *      (north up). Later slices wire geolocation + waypoint bearing.
 *   3. <SurfaceCanvas> mounts the lazy compass scene
 *   4. <SurfaceAudioLayer> ticks the audio mixer; Compass's registered
 *      key signature is 'jaipur' (E phrygian dominant, mid) — see AE376
 *      destination-keys.
 *   5. <useLifecycleAutoDriver> steps idle → materialise → settle → listen
 */
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { SurfaceAudioLayer, useSceneAudioBridge } from '@app/aether-audio';
import { SurfaceCanvas } from '@app/aether-canvas';
import {
  SurfaceManagerProvider,
  SurfacePaletteVars,
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
} from '@app/aether-core';
import { createAetherPhase1Registry } from './aether-registry';
import { CompassBearingProvider } from './compass-bearing-context';
import { Phase1DevNav } from './phase1-dev-nav';
import { BREATHING_LIFECYCLE_PLAN, useLifecycleAutoDriver } from './use-lifecycle-driver';

export interface Phase1CompassShellProps {
  /** Target bearing in degrees. Defaults to 0 (north). */
  readonly bearing?: number;
}

export function Phase1CompassShell({ bearing = 0 }: Phase1CompassShellProps): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname =
    typeof window === 'undefined' ? '/aether/atlas' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <CompassBearingProvider bearing={bearing}>
        <Phase1CompassInner />
      </CompassBearingProvider>
    </SurfaceManagerProvider>
  );
}

function Phase1CompassInner(): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') setRoute(pathname);
  }, [pathname, setRoute]);

  // AE382 — looping plan; closes the lifecycle so dissolve fires.
  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

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
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <SurfacePaletteVars />
      <SurfaceCanvas ariaLabel="Compass — Phase 1 surface">
        <Suspense fallback={null}>
          <ActiveSurfaceMount />
        </Suspense>
      </SurfaceCanvas>
      <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
      <Phase1DevNav active="compass" />
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · audio {audioBridge.status} · drone {audio.drone.toFixed(0)} · events{' '}
        {audio.events.toFixed(0)}
      </div>
    </div>
  );
}

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
