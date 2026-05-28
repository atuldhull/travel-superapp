'use client';

/**
 * Regions grid — six iconic destinations, photo-led.
 *
 * 2-up on tablet, 3-up on desktop. Each card is a photo dominant
 * with overlay text — clicking will land on /aether/destinations/[slug]
 * (stub route added in AE9; until then they all 404 to demonstrate the
 * navigation surface).
 */
import Link from 'next/link';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { REGIONS, REGION_LABELS, photoUrl } from '../photos';
import { SafeImg } from '../safe-img';
import { Reveal } from './reveal';

export function RegionsGrid(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();

  return (
    <section
      id="regions"
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: `${theme.space.hero}px ${theme.space.margin}px`,
      }}
      aria-labelledby="regions-heading"
    >
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: theme.space.gutter }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              color: theme.palette.olive.deep,
              fontSize: 24,
              marginBottom: theme.space.tight,
            }}
          >
            ⌘
          </span>
          <h2
            id="regions-heading"
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
            Discover by region
          </h2>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.large.size,
              color: theme.color.ink.soft,
              margin: `${theme.space.tight}px 0 0`,
            }}
          >
            From desert palaces to coral coastlines — start where the heart points.
          </p>
          <div style={{ marginTop: theme.space.comfy }}>
            <Link
              href="/aether/atlas"
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.body.size,
                fontWeight: 600,
                color: theme.palette.terracotta.deep,
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              See the constellation map →
            </Link>
          </div>
        </div>
      </Reveal>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: theme.space.comfy,
        }}
      >
        {REGIONS.map((photo, idx) => {
          const r = REGION_LABELS[idx]!;
          return (
            <Reveal key={r.slug} delay={idx * 80}>
              <Link
                href={`/aether/destinations/${r.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <article
                  style={{
                    position: 'relative',
                    aspectRatio: '5 / 6',
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                    background: theme.color.ink.deep,
                    boxShadow: theme.elevation.rest.shadow,
                    transition: 'transform 320ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 320ms',
                  }}
                  onMouseEnter={(e) => {
                    if (motionPolicy === 'full') {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = theme.elevation.lifted.shadow;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = theme.elevation.rest.shadow;
                  }}
                >
                  <SafeImg
                    src={photoUrl(photo, 1000)}
                    alt={photo.alt}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(24, 15, 11, 0.0) 35%, rgba(24, 15, 11, 0.75) 100%)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: theme.space.loose,
                      color: theme.color.surface.base,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: theme.palette.ochre.glow,
                        marginBottom: 6,
                      }}
                    >
                      {r.state}
                    </div>
                    <h3
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 32,
                        lineHeight: 1.05,
                        letterSpacing: '-0.018em',
                        fontWeight: 600,
                        margin: 0,
                      }}
                    >
                      {r.name}
                    </h3>
                    <p
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        lineHeight: 1.5,
                        margin: `${theme.space.hairline}px 0 0`,
                        opacity: 0.88,
                      }}
                    >
                      {r.tagline}
                    </p>
                  </div>
                </article>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
