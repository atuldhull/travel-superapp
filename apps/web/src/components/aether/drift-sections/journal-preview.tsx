'use client';

/**
 * Journal preview — three editorial article cards.
 *
 * Magazine-style: tall photo, small-caps kicker, display-serif title,
 * read-time chip. Reveals stagger left-to-right.
 */
import Link from 'next/link';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { JOURNAL, JOURNAL_LABELS, photoUrl } from '../photos';
import { Reveal } from './reveal';

/** Map JOURNAL_LABELS index → real slug in @/components/aether/journal/data.ts. */
const JOURNAL_SLUGS = ['chai-at-first-light', 'monks-of-hemis', 'vanishing-banarsi-loom'] as const;

export function JournalPreview(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();

  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: `${theme.space.hero}px ${theme.space.margin}px`,
      }}
      aria-labelledby="journal-heading"
    >
      <Reveal>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.space.comfy,
            marginBottom: theme.space.gutter,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                color: theme.palette.olive.deep,
                fontSize: 22,
                marginRight: theme.space.tight,
              }}
            >
              ✎
            </span>
            <h2
              id="journal-heading"
              style={{
                display: 'inline',
                fontFamily: theme.font.display,
                fontSize: 'clamp(32px, 4vw, 48px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontWeight: 600,
                margin: 0,
                color: theme.color.ink.base,
              }}
            >
              Stories from the road
            </h2>
          </div>
          <Link
            href="#blog"
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.body.size,
              fontWeight: 600,
              color: theme.palette.terracotta.deep,
              letterSpacing: '0.01em',
              textDecoration: 'none',
            }}
          >
            All the journal →
          </Link>
        </div>
      </Reveal>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: theme.space.loose,
        }}
      >
        {JOURNAL.map((photo, idx) => {
          const j = JOURNAL_LABELS[idx]!;
          return (
            <Reveal key={photo.id} delay={idx * 100}>
              <Link
                href={`/aether/journal/${JOURNAL_SLUGS[idx]}`}
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
                      background: theme.color.surface.deep,
                      marginBottom: theme.space.comfy,
                    }}
                  >
                    <img
                      src={photoUrl(photo, 900)}
                      alt={photo.alt}
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
                      color: theme.palette.terracotta.deep,
                      fontWeight: 600,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    {j.kicker}
                  </div>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(20px, 2vw, 26px)',
                      lineHeight: 1.25,
                      letterSpacing: '-0.012em',
                      fontWeight: 600,
                      margin: 0,
                      color: theme.color.ink.base,
                    }}
                  >
                    {j.title}
                  </h3>
                  <div
                    style={{
                      marginTop: theme.space.comfy,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      color: theme.color.ink.soft,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {j.read}
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
