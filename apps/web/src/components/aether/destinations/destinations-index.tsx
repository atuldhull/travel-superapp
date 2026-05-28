'use client';

/**
 * <DestinationsIndex> — the full set of Aether destinations on one page.
 *
 * Editorial layout: serif masthead + filter chips (Heritage / Mountains
 * / Coast / Cuisine — visual only for now) + a 3-up photo grid showing
 * all 10 destinations. Each card mirrors the RegionsGrid style on Drift
 * but at full density (no truncation).
 */
import Link from 'next/link';
import { useState } from 'react';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { photoUrl } from '../photos';
import { DESTINATIONS, ALL_SLUGS } from './data';

type Filter = 'all' | 'heritage' | 'mountains' | 'coast' | 'cuisine';

/** Slug → which filter buckets it belongs to. A destination can match
 *  more than one (Mumbai is both heritage and coast). Phase 2 wires
 *  this to backend tags. */
const FILTER_MAP: Record<string, ReadonlyArray<Filter>> = {
  jaipur: ['heritage', 'cuisine'],
  alleppey: ['coast'],
  leh: ['mountains'],
  anjuna: ['coast', 'cuisine'],
  hampi: ['heritage'],
  varanasi: ['heritage', 'cuisine'],
  mumbai: ['heritage', 'coast', 'cuisine'],
  coorg: ['mountains', 'cuisine'],
  pondicherry: ['coast', 'cuisine'],
  spiti: ['mountains'],
};

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All journeys' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'mountains', label: 'Mountains' },
  { key: 'coast', label: 'Coast' },
  { key: 'cuisine', label: 'Cuisine' },
];

export function DestinationsIndex(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const [filter, setFilter] = useState<Filter>('all');

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const items = ALL_SLUGS.filter((slug) => {
    if (filter === 'all') return true;
    return FILTER_MAP[slug]?.includes(filter) ?? false;
  });

  return (
    <div
      style={{
        background: surface.base,
        color: ink.base,
        fontFamily: theme.font.ui,
        minHeight: '100vh',
      }}
    >
      <DriftNav />

      {/* Masthead */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.surface}px ${theme.space.margin}px ${theme.space.gutter}px`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            All destinations · दस यात्राएँ
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(48px, 7vw, 92px)',
              lineHeight: 1.0,
              letterSpacing: '-0.026em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
              maxWidth: '18ch',
              marginInline: 'auto',
            }}
          >
            Ten ways to know India.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.5,
              color: ink.soft,
              margin: `${theme.space.loose}px auto 0`,
              maxWidth: '54ch',
            }}
          >
            From a Himalayan high desert at 12,000ft to a French quarter on the Bay of Bengal — the
            country we walk through, the way we walk through it.
          </p>
        </div>
      </Reveal>

      {/* Filter chips */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `0 ${theme.space.margin}px`,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: theme.space.tight,
            marginBottom: theme.space.gutter,
          }}
          role="tablist"
          aria-label="Filter destinations"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  border: `1px solid ${active ? accent.base : ink.whisper}`,
                  background: active ? accent.base : surface.base,
                  color: active ? surface.base : ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition:
                    'background 240ms cubic-bezier(0.42, 0, 0.18, 1), color 240ms, border-color 240ms',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Grid */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `0 ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-label="Destinations"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: theme.space.comfy,
          }}
        >
          {items.map((slug, idx) => {
            const d = DESTINATIONS[slug]!;
            return (
              <Reveal key={slug} delay={idx * 50}>
                <Link
                  href={`/aether/destinations/${slug}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    height: '100%',
                  }}
                >
                  <article
                    style={{
                      position: 'relative',
                      aspectRatio: '5 / 6',
                      borderRadius: theme.radius.lg,
                      overflow: 'hidden',
                      background: ink.deep,
                      boxShadow: theme.elevation.rest.shadow,
                      transition:
                        'transform 320ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 320ms',
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
                    <img
                      src={photoUrl(d.hero, 1000)}
                      alt={d.hero.alt}
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
                          'linear-gradient(180deg, rgba(24, 15, 11, 0) 35%, rgba(24, 15, 11, 0.78) 100%)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: theme.space.loose,
                        color: surface.base,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: ochre.glow,
                          marginBottom: 6,
                          fontWeight: 600,
                        }}
                      >
                        {d.state}
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
                        {d.name}
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
                        {d.tagline}
                      </p>
                    </div>
                  </article>
                </Link>
              </Reveal>
            );
          })}
        </div>

        {items.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: `${theme.space.hero}px 0`,
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 22,
              color: ink.soft,
            }}
          >
            Nothing in this bucket yet. Try another filter, or wander everything.
          </div>
        )}

        <Reveal>
          <div style={{ textAlign: 'center', marginTop: theme.space.hero }}>
            <Link
              href="/aether/atlas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: ink.base,
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                boxShadow: theme.elevation.raised.shadow,
                letterSpacing: '0.01em',
              }}
            >
              See the constellation map
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>

        {/* Quiet stat strip at the bottom */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.hero,
              paddingTop: theme.space.gutter,
              borderTop: `1px solid ${olive.whisper}`,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: theme.space.comfy,
              fontFamily: theme.font.mono,
              fontSize: 11,
              color: ink.soft,
              opacity: 0.6,
              letterSpacing: '0.12em',
            }}
          >
            <span>{ALL_SLUGS.length} destinations · 10 states · 1 country</span>
            <span>Phase 0 preview · curated by hand</span>
          </div>
        </Reveal>
      </section>

      <EditorialFooter />
    </div>
  );
}
