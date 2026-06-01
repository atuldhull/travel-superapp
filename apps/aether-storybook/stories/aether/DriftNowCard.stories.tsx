/**
 * DriftNowCard story (AE449) — Chromatic baseline for the AE385 Drift
 * foreground Now Card. Four variants pin each time-of-day band
 * (morning / afternoon / evening / night) so the eyebrow + suggestion
 * + verb chip stack is reviewable end-to-end.
 *
 * Storybook is isolated from apps/web; the card visuals are
 * re-implemented inline so the snapshot stays deterministic.
 */
import type { Meta, StoryObj } from '@storybook/react';

type Band = 'morning' | 'afternoon' | 'evening' | 'night';

interface CardProps {
  readonly band: Band;
  readonly headline: string;
  readonly suggestion: string;
  readonly verb: string;
}

function DriftNowCard({ band, headline, suggestion, verb }: CardProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        width: 720,
        height: 480,
        // Per-band warm tints so each baseline looks distinct under Chromatic.
        background:
          band === 'morning'
            ? 'linear-gradient(180deg, #FFE6B0 0%, #F2E8D5 100%)'
            : band === 'afternoon'
              ? 'linear-gradient(180deg, #F8D7A2 0%, #F2E8D5 100%)'
              : band === 'evening'
                ? 'linear-gradient(180deg, #E2A86F 0%, #5E3727 100%)'
                : 'linear-gradient(180deg, #1A0F09 0%, #312012 100%)',
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#1A0F09',
      }}
    >
      <aside
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '14px 22px',
          borderRadius: 16,
          background: '#F2E8D5',
          border: '1px solid #E8B777',
          boxShadow: '0 18px 60px rgba(0, 0, 0, 0.35)',
          color: '#1A0F09',
          maxWidth: 320,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#C2614A',
            fontWeight: 600,
          }}
        >
          {headline}
        </span>
        <p
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 17,
            lineHeight: 1.35,
            margin: 0,
          }}
        >
          {suggestion}
        </p>
        <button
          type="button"
          style={{
            marginTop: 2,
            padding: '6px 14px',
            borderRadius: 999,
            background: '#C2614A',
            color: '#F2E8D5',
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {verb}
        </button>
      </aside>
    </div>
  );
}

const meta: Meta<typeof DriftNowCard> = {
  title: 'Aether / DriftNowCard',
  component: DriftNowCard,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof DriftNowCard>;

export const Morning: Story = {
  args: {
    band: 'morning',
    headline: 'Morning',
    suggestion: 'Sketch the day ahead.',
    verb: 'Plan',
  },
};

export const Afternoon: Story = {
  args: {
    band: 'afternoon',
    headline: 'Afternoon',
    suggestion: 'Refine your plan.',
    verb: 'Refine',
  },
};

export const Evening: Story = {
  args: {
    band: 'evening',
    headline: 'Evening',
    suggestion: 'Reflect on today.',
    verb: 'Reflect',
  },
};

export const Night: Story = {
  args: {
    band: 'night',
    headline: 'Night',
    suggestion: 'Dream of where next.',
    verb: 'Dream',
  },
};
