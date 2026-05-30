'use client';

/**
 * <AboutPage> — Aether's manifesto / about surface.
 *
 * Single-page editorial: short eyebrow → display-serif promise →
 * italic dek → six belief blocks (numbered, each a short paragraph) →
 * "the makers" section (founder credits) → contact CTA → footer.
 *
 * The opposite of an SEO landing page — this is a magazine masthead.
 */
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useParallax } from '../use-parallax';
import { useViewport } from '../use-viewport';
import { photoUrl } from '../photos';

interface Belief {
  readonly title: string;
  readonly body: string;
}

const BELIEFS: readonly Belief[] = [
  {
    title: 'Travel is not a checklist',
    body: 'Most apps treat a trip as a sequence of bookings. We treat it as a question: who will you be on the other side of this?',
  },
  {
    title: 'The intelligence is a host, not a salesman',
    body: 'Our AI was trained to listen first. It will not push you toward the highest-margin option. It will not push you anywhere unless you ask.',
  },
  {
    title: 'Local hosts are the product',
    body: 'A homestay with a Marwari family who makes dal-baati by hand is worth more than a five-star room. We curate the people, not the marble.',
  },
  {
    title: 'Slow is a feature',
    body: 'Three days in one village beats a country in two weeks. Our defaults are slow. The planner will fight you on packing too much in.',
  },
  {
    title: 'The land is not décor',
    body: 'Ten percent of every premium booking funds restoration work in the destination — temples, lakes, weavers, monasteries. The receipt is public.',
  },
  {
    title: 'Beautiful design is not a luxury',
    body: 'A planning app that looks like Excel teaches you to think like a spreadsheet. We made this thing the way we wanted to be made — with serif type, sun on stone, and silence.',
  },
];

export function AboutPage(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const heroImgRef = useParallax<HTMLImageElement>({ speed: 0.22, maxOffset: 140 });

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

      {/* Hero */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(72vh, 640px)',
          overflow: 'hidden',
          background: ink.deep,
        }}
        aria-label="About — hero"
      >
        <img
          ref={heroImgRef}
          src={photoUrl(
            {
              id: '1592486058517-36236ba247c8',
              by: 'Madeleine Maguire',
              alt: 'A sunlit grove with stone walls.',
            },
            2400,
          )}
          alt="A sunlit grove."
          style={{
            position: 'absolute',
            inset: '-8% 0',
            width: '100%',
            height: '116%',
            objectFit: 'cover',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, rgba(24, 15, 11, 0.25) 0%, rgba(24, 15, 11, 0.18) 40%, rgba(24, 15, 11, 0.7) 100%)`,
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1280,
            margin: '0 auto',
            padding: isNarrow
              ? `${theme.space.hero}px ${theme.space.comfy}px 0`
              : `${theme.space.surface}px ${theme.space.margin}px 0`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            paddingBottom: theme.space.hero,
            color: surface.base,
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: ochre.glow,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            What we believe · हमारा वादा
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(56px, 8.4vw, 124px)',
              lineHeight: 0.98,
              letterSpacing: '-0.028em',
              fontWeight: 600,
              margin: 0,
              maxWidth: '16ch',
              textShadow: '0 2px 32px rgba(24, 15, 11, 0.5)',
            }}
          >
            A slower way to know the world.
          </h1>
        </div>
      </section>

      {/* Dek */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px ${theme.space.loose}px`,
          }}
        >
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(22px, 2.4vw, 30px)',
              lineHeight: 1.45,
              letterSpacing: '-0.012em',
              color: ink.base,
              margin: 0,
            }}
          >
            We are building a travel app that listens before it speaks — that prefers a stone
            cottage to a chain hotel, a kulhad of chai to a coffee chain, and a homestay grandmother
            to a five-star concierge. This page is the why.
          </p>
        </div>
      </Reveal>

      {/* Beliefs */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-labelledby="beliefs-heading"
      >
        <Reveal>
          <h2
            id="beliefs-heading"
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(28px, 3vw, 40px)',
              lineHeight: 1.1,
              letterSpacing: '-0.018em',
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.loose,
              color: ink.base,
            }}
          >
            Six things we believe
          </h2>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: `${theme.space.gutter}px ${theme.space.loose}px`,
          }}
        >
          {BELIEFS.map((b, idx) => (
            <Reveal key={b.title} delay={idx * 70}>
              <div
                style={{
                  display: 'flex',
                  gap: theme.space.comfy,
                  alignItems: 'flex-start',
                  paddingBottom: theme.space.gutter,
                  borderBottom: `1px solid ${olive.whisper}`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 28,
                    lineHeight: 1,
                    fontWeight: 600,
                    color: accent.base,
                    flexShrink: 0,
                    marginTop: 2,
                    minWidth: '2.2ch',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(20px, 2vw, 25px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.012em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {b.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(16px, 1.5vw, 18px)',
                      lineHeight: 1.6,
                      color: ink.soft,
                      margin: `${theme.space.tight}px 0 0`,
                    }}
                  >
                    {b.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The makers */}
      <section
        style={{
          background: surface.soft,
          borderTop: `1px solid ${ink.whisper}`,
          borderBottom: `1px solid ${ink.whisper}`,
        }}
        aria-labelledby="makers-heading"
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
          }}
        >
          <Reveal>
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
              The makers
            </p>
            <h2
              id="makers-heading"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                color: ink.base,
              }}
            >
              Built by travellers, for travellers.
            </h2>
            <p
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(17px, 1.7vw, 20px)',
                lineHeight: 1.6,
                color: ink.soft,
                margin: `${theme.space.comfy}px 0 0`,
              }}
            >
              TravelSuperApp is a small team, growing slowly, headquartered nowhere in particular.
              We have walked the routes you will walk. We have eaten in the kitchens you will eat
              in. We argue about the difference between a good itinerary and a great one. We will
              keep this software human even when it is no longer small.
            </p>
            <p
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(17px, 1.7vw, 20px)',
                lineHeight: 1.6,
                color: ink.soft,
                margin: `${theme.space.comfy}px 0 0`,
              }}
            >
              If you want to talk to a person, write to{' '}
              <a
                href="mailto:hello@travelsuperapp.in"
                style={{
                  color: accent.deep,
                  textDecoration: 'underline',
                  textDecorationThickness: '1px',
                  textUnderlineOffset: 4,
                  fontWeight: 600,
                }}
              >
                hello@travelsuperapp.in
              </a>
              . If you want to host a journey, write to{' '}
              <a
                href="mailto:hosts@travelsuperapp.in"
                style={{
                  color: accent.deep,
                  textDecoration: 'underline',
                  textDecorationThickness: '1px',
                  textUnderlineOffset: 4,
                  fontWeight: 600,
                }}
              >
                hosts@travelsuperapp.in
              </a>
              . We read everything. We answer most things within a week.
            </p>
          </Reveal>
        </div>
      </section>

      {/* AE95 — Press section. Quiet card linking to /aether/brand
          for partners + journalists needing palette + mark + type. */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.gutter}px`,
          }}
        >
          <div
            style={{
              padding: theme.space.loose,
              borderRadius: theme.radius.lg,
              background: theme.palette.ochre.whisper,
              border: `1px solid ${theme.palette.ochre.deep}`,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '1fr auto',
              gap: theme.space.comfy,
              alignItems: 'center',
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: theme.palette.ochre.deep,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Press · partners · designers
              </p>
              <h2
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(24px, 2.8vw, 36px)',
                  lineHeight: 1.15,
                  letterSpacing: '-0.018em',
                  fontWeight: 600,
                  margin: `${theme.space.tight}px 0 0`,
                  color: ink.base,
                }}
              >
                Open the press kit.
              </h2>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: ink.soft,
                  margin: `${theme.space.tight}px 0 0`,
                  maxWidth: '46ch',
                }}
              >
                The mark, the palette, the per-destination accents, the type stack. Click any hex
                value to copy it. Phase 2 ships a downloadable kit.
              </p>
            </div>
            <Link
              href="/aether/brand"
              style={{
                padding: `${theme.space.tight}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Open /aether/brand →
            </Link>
          </div>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(32px, 4vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
            }}
          >
            Now — where to?
          </h2>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 22px)',
              lineHeight: 1.5,
              color: ink.soft,
              margin: `${theme.space.comfy}px 0 ${theme.space.loose}px`,
            }}
          >
            Open a destination, or let the planner sketch the first draft.
          </p>
          <div
            style={{
              display: 'flex',
              gap: theme.space.comfy,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/aether/plan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                boxShadow: theme.elevation.raised.shadow,
                letterSpacing: '0.01em',
              }}
            >
              Begin the yatra
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/aether/destinations"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: surface.soft,
                color: ink.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                border: `1px solid ${ink.whisper}`,
                letterSpacing: '0.01em',
              }}
            >
              Browse all destinations
            </Link>
          </div>
        </div>
      </Reveal>

      <EditorialFooter />
    </div>
  );
}
