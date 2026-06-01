/**
 * Phase1DevNav story (AE463) — Chromatic baseline for the floating
 * dev-only chip strip that links the two Phase 1 routes (Drift +
 * Compass). Storybook is isolated from Next's `<Link>` + the
 * DissolvingLink helper, so the chips are re-implemented inline as
 * plain anchor tags styled to match phase1-dev-nav.tsx. Each variant
 * pins one of the chips as active so the Warm Italian accent
 * highlight is reviewable.
 */
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

type Active = 'drift' | 'compass' | 'none';

const containerStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 999,
  background: 'rgba(0, 0, 0, 0.45)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.06em',
};

const chipStyle: CSSProperties = {
  color: '#F2E8D5',
  textDecoration: 'none',
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.08)',
  display: 'inline-block',
};

const activeChipStyle: CSSProperties = {
  ...chipStyle,
  background: '#C2614A',
  color: '#180F0B',
};

interface DevNavProps {
  readonly active: Active;
}

function Phase1DevNav({ active }: DevNavProps): React.ReactElement {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #2A1810 0%, #1A0F09 100%)',
        padding: 40,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 360,
      }}
    >
      <div style={containerStyle} aria-hidden>
        <a
          href="/aether/drift"
          style={active === 'drift' ? activeChipStyle : chipStyle}
          data-aether-phase1-devnav-chip="drift"
          data-aether-active={active === 'drift'}
        >
          Drift
        </a>
        <a
          href="/aether/atlas"
          style={active === 'compass' ? activeChipStyle : chipStyle}
          data-aether-phase1-devnav-chip="compass"
          data-aether-active={active === 'compass'}
        >
          Compass
        </a>
      </div>
    </div>
  );
}

const meta: Meta<typeof Phase1DevNav> = {
  title: 'Aether / Phase1DevNav',
  component: Phase1DevNav,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Phase1DevNav>;

export const DriftActive: Story = { args: { active: 'drift' } };
export const CompassActive: Story = { args: { active: 'compass' } };
export const Neither: Story = { args: { active: 'none' } };
