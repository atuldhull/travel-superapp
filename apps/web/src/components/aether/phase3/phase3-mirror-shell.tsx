'use client';

/**
 * AE421/AE422 — Phase 3 Mirror shell, mounted at `/aether/mirror`.
 *
 * Mirrors the Lumen / Vault / Echo shell shape so Mirror inherits the
 * shared cross-cutting capabilities (lifecycle FSM, palette, audio,
 * Pulse hold-to-talk → Genie, Continuum bar). The HTML audit-river
 * overlay lives on top of the R3F globe; AE422 fills in the river
 * rendering, AE421 wires the empty container.
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
import { createAetherPhase1Registry } from '../phase1/aether-registry';
import { Phase1ContinuumBar } from '../phase1/phase1-continuum-bar';
import { Phase1ContinuumReceiverToast } from '../phase1/phase1-continuum-receiver-toast';
import { Phase1DevNav } from '../phase1/phase1-dev-nav';
import { Phase1PulseOverlay } from '../phase1/phase1-pulse-overlay';
import { BREATHING_LIFECYCLE_PLAN, useLifecycleAutoDriver } from '../phase1/use-lifecycle-driver';
import { Phase2GenieModal } from '../phase2/phase2-genie-modal';
import { MirrorAuditRiver } from './mirror-audit-river';
import { SAMPLE_MIRROR_AUDIT } from './mirror-sample-data';

export function Phase3MirrorShell(): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname =
    typeof window === 'undefined' ? '/aether/mirror' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <Phase3MirrorInner />
    </SurfaceManagerProvider>
  );
}

function Phase3MirrorInner(): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') setRoute(pathname);
  }, [pathname, setRoute]);

  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

  const [audio, setAudio] = useState<{ drone: number; events: number }>({
    drone: -60,
    events: -60,
  });
  const audioBridge = useSceneAudioBridge(setAudio);
  const [genieOpen, setGenieOpen] = useState<boolean>(false);

  const isDev = process.env.NODE_ENV !== 'production';
  const pipStyle: CSSProperties = {
    position: 'fixed',
    top: 12,
    left: 12,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.55)',
    color: '#E3E6EC',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    zIndex: 10,
    display: isDev ? 'block' : 'none',
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <SurfacePaletteVars />
      <SurfaceCanvas ariaLabel="Mirror — admin forensics globe">
        <Suspense fallback={null}>
          <ActiveSurfaceMount />
        </Suspense>
      </SurfaceCanvas>
      <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
      <Phase1DevNav />
      <Phase1PulseOverlay onActivate={() => openPulse('')} onHoldOpen={() => setGenieOpen(true)} />
      <Phase2GenieModal open={genieOpen} onClose={() => setGenieOpen(false)} />
      <Phase1ContinuumBar />
      <Phase1ContinuumReceiverToast />
      {/* AE422 — audit-log river overlay on the right edge. */}
      <MirrorAuditRiver rows={SAMPLE_MIRROR_AUDIT} />
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · mirror · {SAMPLE_MIRROR_AUDIT.length} audit rows · audio{' '}
        {audioBridge.status}
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
