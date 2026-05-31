'use client';

/**
 * Phase 1 Drift shell — mounts the SurfaceManagerProvider, SurfaceCanvas
 * with R3F primitives, the SurfaceAudioLayer, and the lifecycle auto-driver.
 *
 * Sibling of `<DriftShell>` (the Phase 0 editorial shell). Selected
 * inside `<DriftShell>` when `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`.
 *
 * The pathname is wired from `usePathname()` so the manager routes to the
 * correct Surface even though apps/web only mounts this on /aether/drift
 * today; the hook lets us extend to more Phase 1 routes (Atlas, Compass)
 * without rewiring.
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
import { openPulse } from '../pulse/open-pulse';
import { useAetherAuth } from '../use-aether-auth';
import { useAetherTripList } from '../use-aether-trip-list';
import { createAetherPhase1Registry } from './aether-registry';
import { DriftNowCard } from './drift-now-card';
import { Phase1ContinuumBar } from './phase1-continuum-bar';
import { Phase1ContinuumReceiverToast } from './phase1-continuum-receiver-toast';
import { Phase1DevNav } from './phase1-dev-nav';
import { Phase1PulseOverlay } from './phase1-pulse-overlay';
import { pickUpcomingTrip, type UpcomingTripLike } from './upcoming-trip';
import { UpcomingTripProvider } from './upcoming-trip-context';
import { BREATHING_LIFECYCLE_PLAN, useLifecycleAutoDriver } from './use-lifecycle-driver';

/** The outer shell — owns the registry + provider. */
export function Phase1DriftShell(): React.ReactElement {
  // Registry lives across the component lifetime; createSurfaceRegistry
  // throws on duplicate-id register so we memo to avoid double-register
  // on Fast Refresh.
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  // Use the in-browser pathname for the first paint so the manager picks
  // the right Surface immediately.
  const initialPathname =
    typeof window === 'undefined' ? '/aether/drift' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <Phase1Inner />
    </SurfaceManagerProvider>
  );
}

/** Inner — needs the manager context, so it lives below the provider. */
function Phase1Inner(): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  // Forward Next pathname changes into the Surface manager.
  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') {
      setRoute(pathname);
    }
  }, [pathname, setRoute]);

  // AE382 — looping plan so the dissolve actually plays out and the
  // audio bridge gets to fade the drone down + back up on a breath.
  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

  // AE393 — read the user's active trip list (gated on auth so a
  // signed-out session doesn't hit the API) and pick the nearest
  // upcoming. Null when none qualify; the Now Card then falls back
  // to AE385 time-of-day baseline.
  const { isAuthed } = useAetherAuth();
  const { trips } = useAetherTripList({ archived: false, limit: '50', enabled: isAuthed });
  const upcomingTrip = useMemo<UpcomingTripLike | null>(() => {
    if (!isAuthed) return null;
    const normalised: ReadonlyArray<UpcomingTripLike> = trips.map((t) => ({
      id: t.id,
      title: t.title,
      // Orval TripDto's runtime nullable fields ship as `string | null`
      // via AE321 asIso — they may also be undefined when omitted.
      startsOn: typeof t.startsOn === 'string' ? t.startsOn : null,
      endsOn: typeof t.endsOn === 'string' ? t.endsOn : null,
      status: typeof t.status === 'string' ? t.status : null,
      archivedAt: typeof t.archivedAt === 'string' ? t.archivedAt : null,
    }));
    return pickUpcomingTrip(normalised);
  }, [isAuthed, trips]);

  // Audio-channel state — surfaced via a tiny status pip the operator
  // can scan for "is the surface alive?" in dev. Production hides it
  // (display: none).
  const [audio, setAudio] = useState<{ drone: number; events: number }>({
    drone: -60,
    events: -60,
  });
  // AE380 — bridge the mixer dB output to the actual Tone.js engine.
  // The bridge handles user-gesture activation (one-shot pointerdown
  // listener) and edge-detection from the dB stream to engine actions.
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
    <UpcomingTripProvider trip={upcomingTrip}>
      <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
        <SurfacePaletteVars />
        <SurfaceCanvas ariaLabel={`Aether Phase 1 surface — ${current?.id ?? 'idle'}`}>
          <Suspense fallback={null}>
            <ActiveSurfaceMount />
          </Suspense>
        </SurfaceCanvas>
        <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
        <DriftNowCard />
        <Phase1DevNav active="drift" />
        {/* AE389 — always-present Pulse 60px corner glow.
          AE392 — tapping the glow opens the editorial Pulse drawer via
          the AE96 `aether-pulse-open` CustomEvent bridge. The drawer
          itself ships from the outer DriftShell so it can persist
          across Phase 0 / Phase 1 flag flips. */}
        <Phase1PulseOverlay onActivate={() => openPulse('')} />
        {/* AE390 — Continuum cross-device handoff bar. */}
        <Phase1ContinuumBar />
        {/* AE391 — receiver side: surface a small "Continued from
          another device" toast when the URL carries the marker. */}
        <Phase1ContinuumReceiverToast />
        <div style={pipStyle} aria-hidden>
          {current?.id ?? '—'} · audio {audioBridge.status} · drone {audio.drone.toFixed(0)} ·
          events {audio.events.toFixed(0)} · upcoming {upcomingTrip?.title ?? 'none'}
        </div>
      </div>
    </UpcomingTripProvider>
  );
}

/** Resolves the current Surface to its lazy mount module + renders it
 *  inside the SurfaceCanvas. Falls back to nothing (the canvas alone)
 *  when the active surface has no mount loader. */
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
