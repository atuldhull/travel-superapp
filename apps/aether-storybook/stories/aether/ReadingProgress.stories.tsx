/**
 * ReadingProgress story (AE78) — Chromatic baseline for the 2px
 * scroll-progress bar that sits above journal articles. Five static
 * stops (0/25/50/75/100%) catch any width-calc or color regression.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface BarProps {
  readonly pct: number;
}

function StaticBar({ pct }: BarProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        background: '#F2E8D5',
        padding: '36px 32px 0',
        borderRadius: 8,
        border: '1px solid #D6CBB0',
      }}
    >
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          pointerEvents: 'none',
          background: 'transparent',
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background: '#C2614A',
            boxShadow: '0 1px 4px #9A4836',
          }}
        />
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          color: '#4A352A',
        }}
      >
        {Math.round(pct * 100)}% read
      </p>
    </div>
  );
}

function Showcase(): React.ReactElement {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div
      style={{
        padding: 32,
        background: '#F2E8D5',
        minHeight: '100vh',
        fontFamily: 'Söhne, system-ui, sans-serif',
      }}
    >
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          margin: 0,
          color: '#2A1E18',
        }}
      >
        ReadingProgress
      </h1>
      <p style={{ fontSize: 16, color: '#4A352A', maxWidth: '60ch' }}>
        Sticky 2px terracotta bar above journal articles. rAF-throttled scroll handler;
        prefers-reduced-motion strips the transition. Five static stops below.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
        {stops.map((s) => (
          <StaticBar key={s} pct={s} />
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof Showcase> = {
  title: 'Aether / ReadingProgress',
  component: Showcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Showcase>;
export const FiveStops: Story = {};
