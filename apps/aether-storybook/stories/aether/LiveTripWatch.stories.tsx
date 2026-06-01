/**
 * LiveTripWatch story (AE427) — Chromatic baseline for the AE425
 * `<LiveTripWatchOverlay>`. Three variants cover the freshness tiers
 * Live / Recent / Stale + a NoSignal variant for the "channel down"
 * fallback. The story is static markup mirroring the production
 * overlay; the freshness label is fixed per variant so Chromatic
 * snapshots stay deterministic.
 */
import type { Meta, StoryObj } from '@storybook/react';

const TIER_COLORS = {
  live: '#34D399',
  recent: '#86EFAC',
  stale: '#6B7280',
} as const;

type Tier = keyof typeof TIER_COLORS;

interface OverlayProps {
  readonly tier: Tier | 'no-signal';
  readonly freshnessLabel: string;
  readonly mode: 'walking' | 'driving' | 'transit' | 'still';
  readonly speedKmH: number | null;
}

function modeGlyph(mode: OverlayProps['mode']): string {
  if (mode === 'walking') return '🚶';
  if (mode === 'driving') return '🚗';
  if (mode === 'transit') return '🚌';
  return '◯';
}

function speedLabel(speedKmH: number | null): string {
  return speedKmH === null ? '— km/h' : `${speedKmH} km/h`;
}

function Overlay({ tier, freshnessLabel, mode, speedKmH }: OverlayProps): React.ReactElement {
  const color = tier === 'no-signal' ? 'rgba(255,255,255,0.18)' : TIER_COLORS[tier];
  const isLive = tier === 'live';
  const dim = tier === 'recent' ? 0.7 : 1;
  return (
    <div
      style={{
        position: 'relative',
        width: 320,
        padding: 36,
        background: 'linear-gradient(135deg, #14110D, #1F1A14)',
        borderRadius: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#F2E8D5',
      }}
    >
      <aside
        style={{
          padding: '10px 14px',
          borderRadius: 14,
          background: 'rgba(20, 12, 8, 0.7)',
          border: `1px solid ${color}`,
          fontSize: 12,
          letterSpacing: '0.04em',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 'fit-content',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.42)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tier === 'no-signal' ? 'transparent' : color,
              boxShadow: isLive ? `0 0 8px ${color}` : 'none',
            }}
          />
          <strong
            style={{
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontSize: 10,
            }}
          >
            {freshnessLabel}
          </strong>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            opacity: dim,
          }}
        >
          <span aria-hidden>{modeGlyph(mode)}</span>
          <span>{mode}</span>
          <span style={{ opacity: 0.7 }}>{speedLabel(speedKmH)}</span>
        </div>
      </aside>
    </div>
  );
}

const meta: Meta<typeof Overlay> = {
  title: 'Aether / LiveTripWatchOverlay',
  component: Overlay,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Overlay>;

export const Live: Story = {
  args: { tier: 'live', freshnessLabel: 'Live · 8s ago', mode: 'walking', speedKmH: 12 },
};

export const Recent: Story = {
  args: { tier: 'recent', freshnessLabel: 'Recent · 2m ago', mode: 'driving', speedKmH: 42 },
};

export const NearStale: Story = {
  args: { tier: 'recent', freshnessLabel: 'Recent · 4m ago', mode: 'transit', speedKmH: 28 },
};

export const NoSignal: Story = {
  args: { tier: 'no-signal', freshnessLabel: 'No live signal', mode: 'still', speedKmH: null },
};
