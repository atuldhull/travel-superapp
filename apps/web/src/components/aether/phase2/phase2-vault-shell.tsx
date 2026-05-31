'use client';

/**
 * AE407 — Phase 2 Vault shell, mounted at `/aether/vault`.
 *
 * Per 02-surfaces.md §8 Vault is the bookings + commerce surface.
 * First cut (AE407) ships:
 *   • the standard Phase 1 chrome (SurfaceManagerProvider + canvas +
 *     audio + Pulse + Continuum)
 *   • a 2D HTML grid of placeholder glyphs sized by AE407
 *     `glyphSize(amount, …)` so the weighted-glyph model is visible
 *     even without the R3F custom shader the eventual scene wants
 *   • a price-history sparkline below each glyph
 *
 * No Stripe Checkout iframe yet — `usePaymentsController*` wiring lands
 * once we have a real booking target plugged in. Until then the glyphs
 * are deterministic fixtures so the visual story is honest.
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
import {
  DEFAULT_VAULT_LAYOUT,
  formatMinorAmount,
  glyphOpacity,
  glyphSize,
  priceDroppedRecently,
  priceSparkline,
  type VaultPriceLike,
} from './vault-glyphs';

/** Phase 2 placeholder price catalogue. Realistic enough that the
 *  shape feels true; real prices come from useStaysControllerSearch /
 *  useTransportControllerRoutes in a later slice. */
const SAMPLE_PRICES: ReadonlyArray<VaultPriceLike> = Object.freeze([
  {
    id: 'leh-stay-7d',
    label: 'Leh — sky garden stay (7 nights)',
    amountMinor: 4200000,
    currency: 'INR',
    history: [4500000, 4480000, 4450000, 4420000, 4380000, 4250000, 4200000],
  },
  {
    id: 'goa-stay-3d',
    label: 'Goa — palm villa (3 nights)',
    amountMinor: 1800000,
    currency: 'INR',
    history: [1900000, 1880000, 1870000, 1840000, 1820000, 1810000, 1800000],
  },
  {
    id: 'jaipur-flight',
    label: 'Mumbai → Jaipur — return',
    amountMinor: 980000,
    currency: 'INR',
    history: [1050000, 1020000, 1010000, 1000000, 990000, 985000, 980000],
  },
  {
    id: 'kerala-houseboat',
    label: 'Alleppey — houseboat (2 nights)',
    amountMinor: 2600000,
    currency: 'INR',
    history: [2700000, 2680000, 2660000, 2640000, 2620000, 2610000, 2600000],
  },
]);

export function Phase2VaultShell(): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname =
    typeof window === 'undefined' ? '/aether/vault' : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <Phase2VaultInner />
    </SurfaceManagerProvider>
  );
}

function Phase2VaultInner(): React.ReactElement {
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

  // Min/max across the catalogue for glyph weighting.
  const minAmount = useMemo(() => Math.min(...SAMPLE_PRICES.map((p) => p.amountMinor)), []);
  const maxAmount = useMemo(() => Math.max(...SAMPLE_PRICES.map((p) => p.amountMinor)), []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <SurfacePaletteVars />
      <SurfaceCanvas ariaLabel="Vault — bookings + commerce">
        <Suspense fallback={null}>
          <ActiveSurfaceMount />
        </Suspense>
      </SurfaceCanvas>
      <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
      <Phase1DevNav />
      <Phase1PulseOverlay onActivate={() => openPulse('')} />
      <Phase1ContinuumBar />
      <Phase1ContinuumReceiverToast />
      {/* AE407 — first-cut 2D glyph grid overlay. R3F custom shader
          lands in a future slice; this gets the visual story up. */}
      <div
        data-aether-vault-grid
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
          padding: 64,
          alignContent: 'center',
          justifyItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {SAMPLE_PRICES.map((p) => {
          const size = glyphSize(p.amountMinor, minAmount, maxAmount) * 80;
          const opacity = glyphOpacity(p.amountMinor, minAmount, maxAmount);
          const dropped = p.history !== undefined && priceDroppedRecently(p.history);
          const spark = priceSparkline(p.history ?? []);
          return (
            <div
              key={p.id}
              data-aether-vault-glyph
              data-aether-vault-id={p.id}
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: 'var(--aether-palette-accent, #C2614A)',
                opacity,
                boxShadow: dropped ? '0 0 28px var(--aether-palette-glow, #E8B777)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--aether-palette-surface, #F2E8D5)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 13,
                textAlign: 'center',
                padding: 8,
                pointerEvents: 'auto',
              }}
            >
              <span data-aether-vault-label style={{ fontWeight: 600 }}>
                {p.label}
              </span>
              <span style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                {formatMinorAmount(p.amountMinor, p.currency)}
              </span>
              {spark.length > 0 && (
                <svg
                  width={DEFAULT_VAULT_LAYOUT.sparklineWidth * 80}
                  height={DEFAULT_VAULT_LAYOUT.sparklineHeight * 80}
                  data-aether-vault-spark
                  style={{ marginTop: 6, opacity: 0.85 }}
                >
                  <polyline
                    fill="none"
                    stroke="var(--aether-palette-surface, #F2E8D5)"
                    strokeWidth={1.5}
                    points={spark.map((pt) => `${pt.x * 80},${pt.y * 80}`).join(' ')}
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · vault · {SAMPLE_PRICES.length} glyphs · audio {audioBridge.status}
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
