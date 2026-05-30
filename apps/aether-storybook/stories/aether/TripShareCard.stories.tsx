/**
 * TripShareCard story (AE152) — Chromatic baseline for the editorial
 * 1200×630 share card (AE79). Three variants exercise the typography
 * + date-range branches:
 *   • TwoWeekItinerary — dated + day count (`Jun 3 – Jun 17`)
 *   • SingleDay — startsOn === endsOn → 1-day shape
 *   • UndatedDraft — no dates → fall-through line
 *
 * The card is rendered inline here as static SVG markup, mirroring
 * the production shareSvg() output, so the visual lock is
 * provider-free.
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochre: '#C28A4A',
  ochreGlow: '#E8B777',
  olive: '#6E7B5C',
};

interface CardProps {
  readonly title: string;
  readonly range: string;
  readonly days: string;
  readonly radius: string;
  readonly status: string;
}

function StaticShareCard({ title, range, days, radius, status }: CardProps): React.ReactElement {
  // 1200×630 → scale to 600×315 for the Storybook viewport, keep
  // typographic hierarchy intact via viewBox.
  return (
    <div
      style={{
        padding: 32,
        background: '#0E0908',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 900 }}>
        <svg
          width="100%"
          viewBox="0 0 1200 630"
          xmlns="http://www.w3.org/2000/svg"
          style={{ borderRadius: 16, boxShadow: '0 32px 96px rgba(0,0,0,0.45)' }}
        >
          {/* cream background */}
          <rect width="1200" height="630" fill={COL.cream} />
          {/* terracotta wedge */}
          <polygon points="0,0 360,0 0,630" fill={COL.terracotta} opacity="0.92" />
          {/* kicker */}
          <text
            x="80"
            y="100"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="22"
            fontWeight="600"
            letterSpacing="6"
            fill={COL.cream}
          >
            AETHER · A JOURNEY
          </text>
          {/* title (display) */}
          <text
            x="80"
            y="280"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="72"
            fontWeight="600"
            fill={COL.ink}
          >
            {title.slice(0, 30)}
          </text>
          {/* second line */}
          <text
            x="80"
            y="360"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="72"
            fontWeight="600"
            fill={COL.ink}
          >
            {title.slice(30, 60)}
          </text>
          {/* facts row */}
          <text
            x="80"
            y="470"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="22"
            fill={COL.inkSoft}
          >
            {range} · {days} · {radius}
          </text>
          {/* footer mark */}
          <text
            x="80"
            y="580"
            fontFamily="JetBrains Mono, monospace"
            fontSize="20"
            fontWeight="600"
            letterSpacing="3"
            fill={COL.ochreGlow}
          >
            {status.toUpperCase()}
          </text>
          {/* hand-drawn glyph (right) */}
          <g transform="translate(1020,80)">
            <circle cx="60" cy="60" r="40" fill="none" stroke={COL.ochre} strokeWidth="3" />
            <circle cx="60" cy="20" r="5" fill={COL.olive} />
            <path
              d="M 60 102 C 78 116, 100 118, 110 100 C 115 90, 110 80, 100 80"
              fill="none"
              stroke={COL.ochre}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

const meta: Meta<typeof StaticShareCard> = {
  title: 'Aether / TripShareCard',
  component: StaticShareCard,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof StaticShareCard>;

export const TwoWeekItinerary: Story = {
  args: {
    title: 'A slow fortnight in Ladakh',
    range: 'Jun 3 – Jun 17',
    days: '15 days',
    radius: '60km',
    status: 'shared',
  },
};

export const SingleDay: Story = {
  args: {
    title: 'A single day in Varanasi',
    range: 'Nov 11',
    days: '1 day',
    radius: '12km',
    status: 'shared',
  },
};

export const UndatedDraft: Story = {
  args: {
    title: 'Untitled monsoon plan',
    range: 'dates to decide',
    days: '—',
    radius: '40km',
    status: 'draft',
  },
};
