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
  SurfacePaletteOverride,
  SurfacePaletteVars,
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
  type SurfacePalette,
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
import { echoPaletteFromDominantColor, formatEchoPostedAt, type EchoAction } from './echo-feed';
import { SAMPLE_ECHO_FEED } from './echo-sample-feed';
import { useEchoSwipe } from './use-echo-swipe';

export function Phase3EchoShell(): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname = typeof window === 'undefined' ? '/aether/feed' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <EchoFeedProvider items={SAMPLE_ECHO_FEED}>
        <PaletteFromActiveEcho>
          <Phase3EchoInner />
        </PaletteFromActiveEcho>
      </EchoFeedProvider>
    </SurfaceManagerProvider>
  );
}

/** AE420 — wraps the inner shell in a `<SurfacePaletteOverride>` whose
 *  palette is derived from the active echo's dominant colour. As the
 *  user scrolls, the override changes and `<SurfacePaletteVars/>` writes
 *  the new CSS vars to the document root so HTML consumers re-tint live. */
function PaletteFromActiveEcho({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { active } = useEchoFeed();
  const palette = useMemo<SurfacePalette>(
    () => echoPaletteFromDominantColor(active?.dominantColor ?? null),
    [active?.dominantColor],
  );
  return <SurfacePaletteOverride palette={palette}>{children}</SurfacePaletteOverride>;
}

function Phase3EchoInner(): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') setRoute(pathname);
  }, [pathname, setRoute]);

  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

  const [, setAudio] = useState<{ drone: number; events: number }>({
    drone: -60,
    events: -60,
  });
  const audioBridge = useSceneAudioBridge(setAudio);
  const [genieOpen, setGenieOpen] = useState<boolean>(false);

  // AE420 — pointer / wheel / keyboard swipe handlers. Save / follow /
  // plan actions surface as short-lived toasts; "plan like this" also
  // pre-fills Pulse with a "trip like this" prompt seeded by the
  // active echo's place + traveller.
  const { items, activeIndex, setActiveIndex, active } = useEchoFeed();
  const [toast, setToast] = useState<string | null>(null);
  const fireAction = (action: EchoAction): void => {
    if (active === null) return;
    switch (action) {
      case 'save-place':
        // Not yet persisted — don't claim a saved effect that never
        // happens. Reworded until the feed/save endpoint is wired.
        setToast(`Save coming soon — ${active.placeName}`);
        break;
      case 'follow-traveller':
        setToast(`Follow coming soon — @${active.travellerHandle}`);
        break;
      case 'plan-like-this':
        setToast(`Asking Pulse to plan a trip like ${active.placeName}…`);
        openPulse(`Plan me a trip like ${active.placeName} — ${active.traveller}'s echo: `);
        break;
      default:
        return;
    }
  };
  useEffect(() => {
    if (toast === null) return undefined;
    const id = window.setTimeout(() => setToast(null), 2_200);
    return (): void => window.clearTimeout(id);
  }, [toast]);
  const swipe = useEchoSwipe({
    items,
    activeIndex,
    setActiveIndex,
    onAction: fireAction,
  });

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
    <div
      data-aether-echo-shell
      tabIndex={0}
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
        touchAction: 'none',
      }}
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
      onWheel={swipe.onWheel}
      onKeyDown={swipe.onKeyDown}
    >
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
      {/* Honesty label — Echo posts are sample content and Save/Follow
          are previews (not yet persisted), so this reads as a preview. */}
      <div
        data-aether-echo-sample-banner
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.55)',
          color: '#F2E8D5',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        Sample feed · Phase 3 preview
      </div>
      {/* AE420 — explicit action row so the gesture set has visible
          affordances. Each button fires the same handler the swipe
          + keyboard paths use. */}
      <nav
        data-aether-echo-actions
        aria-label="Echo actions"
        style={{
          position: 'absolute',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 8,
        }}
      >
        {[
          { action: 'save-place' as const, glyph: '⬆', label: 'Save place (swipe up)' },
          {
            action: 'follow-traveller' as const,
            glyph: '➜',
            label: 'Follow traveller (swipe right)',
          },
          { action: 'plan-like-this' as const, glyph: '✦', label: 'Plan a trip like this' },
        ].map((btn) => (
          <button
            key={btn.action}
            type="button"
            data-aether-echo-action={btn.action}
            aria-label={btn.label}
            title={btn.label}
            onClick={() => fireAction(btn.action)}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '1px solid var(--aether-palette-accent, #C2614A)',
              background: 'rgba(20, 12, 8, 0.55)',
              backdropFilter: 'blur(6px)',
              color: 'var(--aether-palette-surface, #F2E8D5)',
              fontSize: 22,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}
          >
            {btn.glyph}
          </button>
        ))}
      </nav>
      {/* AE420 — toast for the action feedback. Inline so the surface
          has the immediate "this is what just happened" beat without
          the editorial toast graph. */}
      {toast !== null && (
        <div
          role="status"
          aria-live="polite"
          data-aether-echo-toast
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 18px',
            borderRadius: 999,
            background: 'rgba(20,12,8,0.72)',
            color: 'var(--aether-palette-surface, #F2E8D5)',
            border: '1px solid var(--aether-palette-glow, #E8B777)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
            letterSpacing: '0.04em',
            zIndex: 9,
            backdropFilter: 'blur(8px)',
          }}
        >
          {toast}
        </div>
      )}
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
