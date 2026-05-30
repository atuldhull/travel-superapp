/**
 * DriftNav story (AE168) — Chromatic baseline for the top nav bar
 * that mounts on every Aether shell. Two static variants:
 *   • Default — guest user, no audio chip status
 *   • Authed — `Sign in` swapped for `My atlas`, audio chip in 'on' state
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  inkWhisper: '#D6CBB0',
  terracotta: '#C2614A',
  ochreGlow: '#D9A66B',
};

interface NavProps {
  readonly authed?: boolean;
  readonly audioOn?: boolean;
}

function StaticDriftNav({ authed, audioOn }: NavProps): React.ReactElement {
  return (
    <div
      style={{
        background: COL.cream,
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 32px',
          borderBottom: `1px solid ${COL.inkWhisper}`,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: COL.terracotta,
              color: COL.cream,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            ॐ
          </span>
          <span
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 22,
              fontWeight: 600,
              color: COL.ink,
            }}
          >
            TravelSuperApp
          </span>
        </div>

        {/* Center nav */}
        <nav style={{ display: 'flex', gap: 28 }}>
          {['Drift', 'Atlas', 'Destinations', 'Journal', 'About'].map((label) => (
            <span
              key={label}
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 13,
                color: COL.inkSoft,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          ))}
        </nav>

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* AudioChip */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${audioOn === true ? COL.ochreGlow : COL.inkWhisper}`,
              fontSize: 11,
              color: audioOn === true ? COL.ochreGlow : COL.inkSoft,
            }}
          >
            <span style={{ fontSize: 9 }}>{audioOn === true ? '◉' : '○'}</span>
            audio
          </span>
          {/* Auth pill */}
          <span
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              background: authed === true ? 'transparent' : COL.ink,
              color: authed === true ? COL.ink : COL.cream,
              border: authed === true ? `1px solid ${COL.ink}` : 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {authed === true ? 'My atlas →' : 'Sign in'}
          </span>
        </div>
      </header>

      <div style={{ padding: 64, textAlign: 'center', color: COL.inkSoft }}>
        Page body would render below the nav.
      </div>
    </div>
  );
}

const meta: Meta<typeof StaticDriftNav> = {
  title: 'Aether / DriftNav',
  component: StaticDriftNav,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof StaticDriftNav>;
export const Default: Story = { args: {} };
export const Authed: Story = { args: { authed: true } };
export const AuthedAudioOn: Story = { args: { authed: true, audioOn: true } };
