'use client';

/**
 * AE418/AE419 — Phase 3 Echo shell, mounted at `/aether/feed`.
 *
 * Mirrors the Phase 2 shell shape (Lumen / Vault) so Echo inherits
 * every cross-cutting capability: lifecycle FSM, palette, audio,
 * Pulse hold-to-talk → Genie, Continuum bar. AE420 layers the live
 * palette re-derivation from each echo's dominant colour on top of
 * the registry baseline.
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
import { EchoFeedProvider, useEchoFeed } from './echo-context';
import { formatEchoPostedAt } from './echo-feed';
import { SAMPLE_ECHO_FEED } from './echo-sample-feed';

export function Phase3EchoShell(): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname = typeof window === 'undefined' ? '/aether/feed' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <EchoFeedProvider items={SAMPLE_ECHO_FEED}>
        <Phase3EchoInner />
      </EchoFeedProvider>
    </SurfaceManagerProvider>
  );
}

function Phase3EchoInner(): React.ReactElement {
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
    color: '#F2E8D5',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    zIndex: 10,
    display: isDev ? 'block' : 'none',
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <SurfacePaletteVars />
      <SurfaceCanvas ariaLabel="Echo — social feed">
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
      {/* AE418 — diary overlay. AE420 wires swipe gestures + palette
          re-derivation; AE419 wires R3F textured planes underneath. */}
      <EchoDiaryOverlay />
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · echo · {SAMPLE_ECHO_FEED.length} items · audio {audioBridge.status}
      </div>
    </div>
  );
}

/** Diary overlay — palette-tinted HTML card showing the active echo's
 *  diary copy + place name + traveller. AE419 will move some of this
 *  into the R3F scene; for AE418 it's a single floating card. */
function EchoDiaryOverlay(): React.ReactElement | null {
  const { active } = useEchoFeed();
  if (active === null) return null;
  return (
    <div
      data-aether-echo-overlay
      style={{
        position: 'absolute',
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(640px, 92vw)',
        padding: '20px 24px',
        borderRadius: 18,
        background: 'rgba(20, 12, 8, 0.55)',
        backdropFilter: 'blur(8px)',
        color: 'var(--aether-palette-surface, #F2E8D5)',
        fontFamily: 'Inter, system-ui, sans-serif',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      <p
        data-aether-echo-meta
        style={{
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          opacity: 0.75,
          margin: 0,
        }}
      >
        {active.traveller} · {active.placeName} · {formatEchoPostedAt(active.postedAt)}
      </p>
      <p
        data-aether-echo-diary
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontStyle: 'italic',
          fontSize: 20,
          lineHeight: 1.4,
          margin: '6px 0 0',
        }}
      >
        “{active.diary}”
      </p>
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
