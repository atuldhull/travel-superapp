'use client';

/**
 * Stat strip — quiet social proof between hero and Esperienze.
 *
 * Numbers, not adjectives. Big display serif for the figure, small
 * caps for the label. Olive divider lines between cells echo the
 * cream + olive palette without competing with the hero.
 */
import { useTheme } from '@app/aether-core';
import { Reveal } from './reveal';

interface Stat {
  readonly figure: string;
  readonly label: string;
}

const STATS: readonly Stat[] = [
  { figure: '28', label: 'Indian states' },
  { figure: '1,200+', label: 'Local hosts' },
  { figure: '4.9', label: 'Traveller rating' },
  { figure: '50k', label: 'Journeys planned' },
];

export function StatStrip(): React.ReactElement {
  const theme = useTheme();
  return (
    <Reveal as="section">
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px`,
        }}
      >
        <div
          role="list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            border: `1px solid ${theme.color.ink.whisper}`,
            borderRadius: theme.radius.lg,
            background: theme.color.surface.soft,
            overflow: 'hidden',
          }}
        >
          {STATS.map((s, idx) => (
            <div
              key={s.label}
              role="listitem"
              style={{
                padding: `${theme.space.loose}px ${theme.space.comfy}px`,
                textAlign: 'center',
                borderLeft: idx > 0 ? `1px solid ${theme.color.ink.whisper}` : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(36px, 4vw, 52px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  fontWeight: 600,
                  color: theme.palette.terracotta.deep,
                }}
              >
                {s.figure}
              </div>
              <div
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: theme.color.ink.soft,
                  marginTop: theme.space.tight,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
