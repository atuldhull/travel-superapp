'use client';

/**
 * <JournalArticleView> — editorial long-form article layout.
 *
 * Newsroom shape: kicker → big serif title → italic dek → author/date
 * meta → hero photo → narrow column of body paragraphs with optional
 * pull-quotes and h2 dividers. Generous line-height + serif body
 * (rare on the web; usual in print).
 */
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useParallax } from '../use-parallax';
import { useViewport } from '../use-viewport';
import { photoUrl } from '../photos';
import { type JournalArticle } from './data';

export interface JournalArticleViewProps {
  article: JournalArticle;
}

export function JournalArticleView({ article: a }: JournalArticleViewProps): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const heroImgRef = useParallax<HTMLImageElement>({ speed: 0.25, maxOffset: 160 });

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

      {/* Title block */}
      <section
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.tight}px`
            : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.gutter}px`,
          textAlign: 'center',
        }}
      >
        <Reveal>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            {a.kicker}
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(36px, 5.2vw, 72px)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
              maxWidth: '20ch',
              marginInline: 'auto',
            }}
          >
            {a.title}
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.55,
              color: ink.soft,
              margin: `${theme.space.loose}px auto 0`,
              maxWidth: '52ch',
            }}
          >
            {a.dek}
          </p>
          <div
            style={{
              marginTop: theme.space.gutter,
              display: 'flex',
              gap: theme.space.comfy,
              justifyContent: 'center',
              fontFamily: theme.font.ui,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: ink.soft,
              opacity: 0.78,
            }}
          >
            <span>By {a.author}</span>
            <span aria-hidden>·</span>
            <span>{a.readMins} min read</span>
            <span aria-hidden>·</span>
            <span>{a.publishedOn}</span>
          </div>
        </Reveal>
      </section>

      {/* Hero */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `0 ${theme.space.margin}px`,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              background: ink.deep,
            }}
          >
            <img
              ref={heroImgRef}
              src={photoUrl(a.hero, 2400)}
              alt={a.hero.alt}
              style={{
                position: 'absolute',
                inset: '-6% 0',
                width: '100%',
                height: '112%',
                objectFit: 'cover',
              }}
            />
          </div>
          <p
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: ink.soft,
              opacity: 0.6,
              margin: `${theme.space.tight}px 0 0`,
              textAlign: 'right',
            }}
          >
            Photograph · {a.hero.by} / Unsplash
          </p>
        </div>
      </Reveal>

      {/* Body */}
      <Reveal as="article">
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
          }}
        >
          {a.body.map((block, idx) => {
            if (block.kind === 'p') {
              return (
                <p
                  key={idx}
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(17px, 1.4vw, 19px)',
                    lineHeight: 1.7,
                    letterSpacing: '-0.005em',
                    color: ink.base,
                    margin: `0 0 ${theme.space.loose}px`,
                  }}
                >
                  {block.text}
                </p>
              );
            }
            if (block.kind === 'pull') {
              return (
                <blockquote
                  key={idx}
                  style={{
                    margin: `${theme.space.gutter}px 0`,
                    padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                    borderLeft: `3px solid ${accent.base}`,
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 'clamp(20px, 1.8vw, 26px)',
                    lineHeight: 1.4,
                    color: ink.base,
                    background: surface.soft,
                    borderRadius: `0 ${theme.radius.md}px ${theme.radius.md}px 0`,
                  }}
                >
                  {block.text}
                </blockquote>
              );
            }
            // h2
            return (
              <h2
                key={idx}
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(24px, 2.4vw, 32px)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.014em',
                  fontWeight: 600,
                  color: ink.base,
                  margin: `${theme.space.hero}px 0 ${theme.space.loose}px`,
                  borderTop: `1px solid ${olive.whisper}`,
                  paddingTop: theme.space.gutter,
                }}
              >
                {block.text}
              </h2>
            );
          })}

          {/* Read next */}
          <div
            style={{
              marginTop: theme.space.hero,
              padding: `${theme.space.gutter}px 0`,
              borderTop: `1px solid ${ink.whisper}`,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: theme.space.comfy,
              alignItems: 'baseline',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: ochre.glow,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Up next
              </div>
              <Link
                href="/aether/drift"
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 22,
                  fontWeight: 600,
                  color: ink.base,
                  textDecoration: 'none',
                }}
              >
                The journal index →
              </Link>
            </div>
            <Link
              href="/aether/drift"
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                fontWeight: 600,
                color: accent.deep,
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              ← Back to Drift
            </Link>
          </div>
        </div>
      </Reveal>

      <EditorialFooter />
    </div>
  );
}
