'use client';

/**
 * Voices — three traveller quotes on a cream-soft band.
 *
 * Editorial pattern: oversized opening quote-mark in terracotta, the
 * quote in italic display serif, the attribution in small caps under
 * an olive divider. Three side-by-side on desktop, stacked on mobile.
 *
 * Phase 0 testimonials are illustrative placeholders. Replace with
 * real traveller voices when the product has them.
 */
import { useTheme } from '@app/aether-core';
import { Reveal } from './reveal';

interface Voice {
  readonly quote: string;
  readonly name: string;
  readonly trip: string;
}

const VOICES: readonly Voice[] = [
  {
    quote:
      'They got the small things right — a kulhad of chai waiting at the station, the right driver who knew the back lanes. I felt taken care of, not sold to.',
    name: 'Ananya M.',
    trip: 'Varanasi · 5 days',
  },
  {
    quote:
      'I asked for solitude and got a stone cottage in Spiti with a host who had stories from forty years of trekking. It rewired what I thought a trip could be.',
    name: 'Karthik R.',
    trip: 'Spiti Valley · 9 days',
  },
  {
    quote:
      'The itinerary breathed with my mood. Slow days when I needed them, hidden festivals when I was up for it. Travel that listens back.',
    name: 'Priya & Daniel',
    trip: 'Kerala loop · 14 days',
  },
];

export function Voices(): React.ReactElement {
  const theme = useTheme();

  return (
    <section
      style={{
        background: theme.color.surface.soft,
        borderTop: `1px solid ${theme.color.ink.whisper}`,
        borderBottom: `1px solid ${theme.color.ink.whisper}`,
      }}
      aria-labelledby="voices-heading"
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.hero}px ${theme.space.margin}px`,
        }}
      >
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: theme.space.hero }}>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                color: theme.palette.olive.deep,
                fontSize: 24,
                marginBottom: theme.space.tight,
              }}
            >
              ❝
            </span>
            <h2
              id="voices-heading"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(36px, 4.5vw, 56px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontWeight: 600,
                margin: 0,
                color: theme.color.ink.base,
              }}
            >
              Voices from the road
            </h2>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.large.size,
                color: theme.color.ink.soft,
                margin: `${theme.space.tight}px 0 0`,
              }}
            >
              What travellers said when they came home.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: theme.space.gutter,
          }}
        >
          {VOICES.map((v, idx) => (
            <Reveal key={v.name} delay={idx * 110}>
              <figure style={{ margin: 0 }}>
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    fontFamily: theme.font.display,
                    fontSize: 72,
                    lineHeight: 0.8,
                    color: theme.palette.terracotta.glow,
                    marginBottom: -8,
                  }}
                >
                  &ldquo;
                </span>
                <blockquote
                  style={{
                    margin: 0,
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(18px, 1.5vw, 21px)',
                    fontStyle: 'italic',
                    lineHeight: 1.55,
                    color: theme.color.ink.base,
                  }}
                >
                  {v.quote}
                </blockquote>
                <figcaption
                  style={{
                    marginTop: theme.space.comfy,
                    paddingTop: theme.space.tight,
                    borderTop: `1px solid ${theme.palette.olive.whisper}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.body.size,
                      fontWeight: 600,
                      color: theme.color.ink.base,
                    }}
                  >
                    {v.name}
                  </div>
                  <div
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: theme.color.ink.soft,
                      marginTop: 2,
                    }}
                  >
                    {v.trip}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
