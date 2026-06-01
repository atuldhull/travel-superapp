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
} from './vault-glyphs';
import {
  SAMPLE_VAULT_MAX_AMOUNT,
  SAMPLE_VAULT_MIN_AMOUNT,
  SAMPLE_VAULT_PRICES,
} from './vault-sample-prices';
import { VaultCheckoutPanel } from './vault-checkout-panel';
import type { VaultPriceLike } from './vault-glyphs';

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

  // AE414 — shared min/max + sample set with the R3F scene so the
  // 2D labels + 3D spheres weight identically.
  const minAmount = SAMPLE_VAULT_MIN_AMOUNT;
  const maxAmount = SAMPLE_VAULT_MAX_AMOUNT;

  // AE415 — checkout state: which price the user tapped (null = panel closed).
  const [selectedPrice, setSelectedPrice] = useState<VaultPriceLike | null>(null);

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
        {SAMPLE_VAULT_PRICES.map((p) => {
          const size = glyphSize(p.amountMinor, minAmount, maxAmount) * 80;
          const opacity = glyphOpacity(p.amountMinor, minAmount, maxAmount);
          const dropped = p.history !== undefined && priceDroppedRecently(p.history);
          const spark = priceSparkline(p.history ?? []);
          return (
            <button
              key={p.id}
              type="button"
              data-aether-vault-glyph
              data-aether-vault-id={p.id}
              aria-label={`Book ${p.label}`}
              onClick={() => setSelectedPrice(p)}
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
                border: 'none',
                cursor: 'pointer',
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
            </button>
          );
        })}
      </div>
      {/* AE415 — checkout panel slides in when a glyph is tapped. */}
      <VaultCheckoutPanel price={selectedPrice} onClose={() => setSelectedPrice(null)} />
      <div style={pipStyle} aria-hidden>
        {current?.id ?? '—'} · vault · {SAMPLE_VAULT_PRICES.length} glyphs · audio{' '}
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
