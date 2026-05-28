'use client';

/**
 * <JournalIndex> — list of all journal articles.
 *
 * Editorial pattern: a single featured article (most recent) at the
 * top spanning two columns, then the remaining articles below in a
 * two-up grid. Each card mirrors the JournalPreview style — same
 * kicker / serif title / read-time / photograph language.
 */
import Link from 'next/link';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { photoUrl } from '../photos';
import { SafeImg } from '../safe-img';
import { useViewport } from '../use-viewport';
import { JOURNAL_ARTICLES, ALL_JOURNAL_SLUGS } from './data';

export function JournalIndex(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();

  const articles = ALL_JOURNAL_SLUGS.map((slug) => JOURNAL_ARTICLES[slug]!);
  const featured = articles[0]!;
  const rest = articles.slice(1);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

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
            padding: isNarrow
              ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.comfy}px`
              : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.gutter}px`,
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
            The Journal
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
              maxWidth: '20ch',
              marginInline: 'auto',
            }}
          >
            Long-form notes from the road.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.5,
              color: ink.soft,
              margin: `${theme.space.loose}px auto 0`,
              maxWidth: '56ch',
            }}
          >
            Field notes, pilgrim trails, craft stories. One letter a month, the rest in the archives
            below. No sponsored posts, no roundups, no top-tens.
          </p>
        </div>
      </Reveal>

      {/* Featured article — full-width hero card */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `0 ${theme.space.margin}px`,
          }}
        >
          <Link
            href={`/aether/journal/${featured.slug}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <article
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 1.2fr) 1fr',
                gap: theme.space.loose,
                alignItems: 'center',
                borderRadius: theme.radius.xl,
                overflow: 'hidden',
                background: surface.soft,
                border: `1px solid ${ink.whisper}`,
                transition: 'transform 320ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 320ms',
              }}
              onMouseEnter={(e) => {
                if (motionPolicy === 'full') {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = theme.elevation.lifted.shadow;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ aspectRatio: '4 / 3', background: surface.deep }}>
                <SafeImg
                  src={photoUrl(featured.hero, 1400)}
                  alt={featured.hero.alt}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              </div>
              <div
                style={{
                  padding: `${theme.space.loose}px ${theme.space.loose}px ${theme.space.loose}px 0`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: accent.deep,
                    fontWeight: 600,
                    marginBottom: theme.space.tight,
                  }}
                >
                  Featured · {featured.kicker}
                </div>
                <h2
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(28px, 3.4vw, 44px)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.018em',
                    fontWeight: 600,
                    margin: 0,
                    color: ink.base,
                  }}
                >
                  {featured.title}
                </h2>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 'clamp(16px, 1.6vw, 19px)',
                    lineHeight: 1.5,
                    color: ink.soft,
                    margin: `${theme.space.comfy}px 0`,
                  }}
                >
                  {featured.dek}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: theme.space.comfy,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: ink.soft,
                    opacity: 0.78,
                  }}
                >
                  <span>By {featured.author}</span>
                  <span aria-hidden>·</span>
                  <span>{featured.readMins} min read</span>
                </div>
              </div>
            </article>
          </Link>
        </div>
      </Reveal>

      {/* Rest of the archive */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.hero}px ${theme.space.margin}px`,
        }}
        aria-labelledby="archive-heading"
      >
        <Reveal>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: theme.space.comfy,
              marginBottom: theme.space.loose,
              flexWrap: 'wrap',
              borderBottom: `1px solid ${ink.whisper}`,
              paddingBottom: theme.space.comfy,
            }}
          >
            <h2
              id="archive-heading"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontWeight: 600,
                margin: 0,
                color: ink.base,
              }}
            >
              From the archive
            </h2>
            <span
              style={{
                fontFamily: theme.font.mono,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: ink.soft,
                opacity: 0.6,
              }}
            >
              {articles.length} pieces · updated monthly
            </span>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: theme.space.gutter,
          }}
        >
          {rest.map((a, idx) => (
            <Reveal key={a.slug} delay={idx * 90}>
              <Link
                href={`/aether/journal/${a.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  height: '100%',
                }}
              >
                <article
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    transition: 'transform 320ms cubic-bezier(0.42, 0, 0.18, 1)',
                  }}
                  onMouseEnter={(e) => {
                    if (motionPolicy === 'full') {
                      const img = e.currentTarget.querySelector('img');
                      if (img !== null) img.style.transform = 'scale(1.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const img = e.currentTarget.querySelector('img');
                    if (img !== null) img.style.transform = 'scale(1)';
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '4 / 5',
                      borderRadius: theme.radius.lg,
                      overflow: 'hidden',
                      background: surface.deep,
                      marginBottom: theme.space.comfy,
                    }}
                  >
                    <SafeImg
                      src={photoUrl(a.hero, 900)}
                      alt={a.hero.alt}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 700ms cubic-bezier(0.42, 0, 0.18, 1)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: accent.deep,
                      fontWeight: 600,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    {a.kicker}
                  </div>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(20px, 2vw, 26px)',
                      lineHeight: 1.25,
                      letterSpacing: '-0.012em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {a.title}
                  </h3>
                  <div
                    style={{
                      marginTop: theme.space.comfy,
                      display: 'flex',
                      gap: theme.space.comfy,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      color: ink.soft,
                    }}
                  >
                    <span>By {a.author}</span>
                    <span aria-hidden>·</span>
                    <span>{a.readMins} min</span>
                  </div>
                </article>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What we publish strip */}
      <section
        style={{
          background: ochre.whisper,
          borderTop: `1px solid ${olive.whisper}`,
          borderBottom: `1px solid ${olive.whisper}`,
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
            textAlign: 'center',
          }}
        >
          <Reveal>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3vw, 40px)',
                lineHeight: 1.15,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                color: ink.base,
              }}
            >
              What we publish
            </h2>
            <p
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(17px, 1.8vw, 21px)',
                lineHeight: 1.6,
                color: ink.soft,
                margin: `${theme.space.comfy}px 0 0`,
              }}
            >
              No top-tens. No sponsored content. No SEO bait. We publish field notes from the road,
              craft stories from people who still make things by hand, and pilgrim trails from
              places that have been walked for a thousand years. One long piece a month, read in the
              time it takes to drink a cup of chai.
            </p>
          </Reveal>
        </div>
      </section>

      <EditorialFooter />
    </div>
  );
}
