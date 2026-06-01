/**
 * ContinuumBar story (AE450) — Chromatic baseline for the AE390
 * cross-device handoff edge-line overlay. Three variants pin the
 * lifecycle states (idle / sigil / listening) so the sigil + the
 * receiver toast chrome are reviewable end-to-end.
 *
 * Inline re-implementation because the storybook workspace is
 * isolated; static markup so Chromatic snapshots stay deterministic.
 */
import type { Meta, StoryObj } from '@storybook/react';

type State = 'idle' | 'sigil' | 'listening';

interface BarProps {
  readonly state: State;
  readonly sigilLabel: string;
}

function ContinuumBar({ state, sigilLabel }: BarProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        width: 720,
        height: 80,
        background: 'rgba(20, 12, 8, 0.9)',
        borderTop: '1px solid #6E7B5C',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#F2E8D5',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 24px',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: state === 'listening' ? '#34D399' : state === 'sigil' ? '#E8B777' : '#6E7B5C',
          boxShadow: state !== 'idle' ? `0 0 12px currentColor` : 'none',
        }}
      />
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        Continuum
      </span>
      {state === 'sigil' ? (
        <span
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 16,
            color: '#E8B777',
            letterSpacing: '0.02em',
          }}
        >
          {sigilLabel}
        </span>
      ) : null}
      {state === 'listening' ? (
        <span
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 14,
            color: '#34D399',
            letterSpacing: '0.02em',
          }}
        >
          Awaiting handoff…
        </span>
      ) : null}
    </div>
  );
}

const meta: Meta<typeof ContinuumBar> = {
  title: 'Aether / ContinuumBar',
  component: ContinuumBar,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof ContinuumBar>;

export const Idle: Story = {
  args: { state: 'idle', sigilLabel: '' },
};

export const SigilShown: Story = {
  args: { state: 'sigil', sigilLabel: 'Leh · Diskit · 14:00' },
};

export const Listening: Story = {
  args: { state: 'listening', sigilLabel: '' },
};
