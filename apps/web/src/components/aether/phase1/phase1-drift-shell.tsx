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
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
} from '@app/aether-core';
import { createAetherPhase1Registry } from './aether-registry';
import { useLifecycleAutoDriver } from './use-lifecycle-driver';

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

  // Auto-step idle → materialising → settling → listening on mount.
  useLifecycleAutoDriver();

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
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <SurfaceCanvas ariaLabel={`Aether Phase 1 surface — ${current?.id ?? 'idle'}`}>
        <Suspense fallback={null}>
          <ActiveSurfaceMount />
        </Suspense>
      </SurfaceCanvas>
      <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · audio {audioBridge.status} · drone {audio.drone.toFixed(0)} · events{' '}
        {audio.events.toFixed(0)}
      </div>
    </div>
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
