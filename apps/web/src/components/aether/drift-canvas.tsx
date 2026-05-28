'use client';

/**
 * Drift — Aether's home surface (India edition, AE8 finishing pass).
 *
 * Magazine-grade composition. Bones derived from the Sapore Italiano
 * reference; content applied to the Indian context; motion driven by
 * the locked Aether tokens (k=120 d=18 spring, 0.42/0/0.18/1 standard
 * easing, IntersectionObserver-driven one-shot reveals).
 *
 * Sections (top to bottom):
 *   1. <DriftNav>           — sticky, transparent-over-hero → glass-cream on scroll
 *   2. Hero                 — full-bleed Taj photo + parallax + display headline +
 *                             italic lede + CTA + season chips + scroll indicator
 *   3. <StatStrip>          — 28 states · 1,200 hosts · 4.9★ · 50k journeys
 *   4. Esperienze grid      — 4 photo cards (Heritage / Cuisine / Mountains / Coast)
 *   5. <RegionsGrid>        — 6 destination cards (Jaipur / Alleppey / Leh / Anjuna
 *                             / Hampi / Varanasi) linking to /aether/destinations/:slug
 *   6. Swaad band           — full-bleed spice market + centered CTA
 *   7. <Voices>             — 3 italic-serif testimonial quotes
 *   8. <JournalPreview>     — 3 editorial article cards
 *   9. Trust signals        — 4-column why-us strip
 *  10. <EditorialFooter>    — multi-column sitemap on espresso band
 *
 * Hero photo + every below-fold section honor motion policy:
 *   • full     → parallax + ken-burns + staggered reveal-on-scroll
 *   • essential → parallax/reveal disabled, layout intact
 *   • none      → all transitions stripped, instant render
 */
import { useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useAudioEngine, useMotionPolicy, useTheme } from '@app/aether-core';
import { EXPERIENCES, GUSTARE, HERO, photoUrl } from './photos';
import { DriftNav } from './drift-nav';
import { useParallax } from './use-parallax';
import { Reveal } from './drift-sections/reveal';
import { FeaturedChips } from './drift-sections/featured-chips';
import { StatStrip } from './drift-sections/stat-strip';
import { RegionsGrid } from './drift-sections/regions-grid';
import { Voices } from './drift-sections/voices';
import { JournalPreview } from './drift-sections/journal-preview';
import { EditorialFooter } from './drift-sections/editorial-footer';
import { ScrollIndicator } from './drift-sections/scroll-indicator';

const EXPERIENCE_LABELS: ReadonlyArray<{ title: string; subtitle: string; cta: string }> = [
  { title: 'Royal heritage', subtitle: 'Forts, palaces & living history.', cta: 'Explore →' },
  {
    title: 'Regional cuisine',
    subtitle: 'From thali to street, every state a flavour.',
    cta: 'Taste →',
  },
  {
    title: 'Himalayan retreats',
    subtitle: 'High passes, quiet monasteries, mountain air.',
    cta: 'Wander →',
  },
  { title: 'Coastal soul', subtitle: 'Backwaters, beaches & slow afternoons.', cta: 'Drift →' },
];

const TRUST_SIGNALS: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  { icon: '◐', title: 'Curated journeys', body: 'Hand-picked, never generic.' },
  { icon: '⋄', title: 'Local hosts', body: 'Real people who know the place.' },
  { icon: '✓', title: 'Booking, secured', body: 'No surprises, no fine print.' },
  { icon: '♻', title: 'Travel with care', body: 'Honour the land and the people.' },
];

export function DriftCanvas(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { engine, status } = useAudioEngine();

  const handleActivate = useCallback(() => {
    void engine.activate().then(() => engine.startAmbient());
  }, [engine]);

  useEffect(() => {
    return () => engine.stopAmbient();
  }, [engine]);

  // Parallax ref for the hero photo — drifts up at 0.3x scroll speed.
  const heroImgRef = useParallax<HTMLImageElement>({ speed: 0.3, maxOffset: 200 });

  // Token shortcuts. App code never writes raw hex.
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

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(96vh, 920px)',
          overflow: 'hidden',
          background: ink.deep,
        }}
        aria-label="Hero"
      >
        {/* Hero photograph — parallax drift on scroll */}
        <img
          ref={heroImgRef}
          src={photoUrl(HERO, 2400)}
          alt={HERO.alt}
          style={{
            position: 'absolute',
            inset: '-10% 0 -10% 0',
            width: '100%',
            height: '120%',
            objectFit: 'cover',
            transform: motionPolicy === 'full' ? 'scale(1.04)' : 'none',
            transformOrigin: '50% 55%',
            transition: 'transform 28s cubic-bezier(0.42, 0, 0.18, 1)',
            willChange: motionPolicy === 'full' ? 'transform' : 'auto',
          }}
        />
        {/* Cream-tinted scrim — preserves photo while lifting palette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(24, 15, 11, 0.15) 0%,
              rgba(24, 15, 11, 0.05) 30%,
              rgba(24, 15, 11, 0.65) 100%)`,
          }}
          aria-hidden
        />

        {/* Headline column */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.surface}px ${theme.space.margin}px 0`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            paddingBottom: theme.space.hero + theme.space.gutter,
            color: surface.base,
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: ochre.glow,
              margin: 0,
              marginBottom: theme.space.tight,
              fontWeight: 600,
            }}
          >
            TravelSuperApp · यात्रा · journeys across Bharat
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(56px, 8.4vw, 124px)',
              lineHeight: 0.98,
              letterSpacing: '-0.028em',
              fontWeight: 600,
              margin: 0,
              maxWidth: '14ch',
              textShadow: '0 2px 32px rgba(24, 15, 11, 0.45)',
            }}
          >
            Live Bharat.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(22px, 2.4vw, 32px)',
              lineHeight: 1.3,
              letterSpacing: '-0.015em',
              fontStyle: 'italic',
              fontWeight: 400,
              margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
              color: surface.soft,
              maxWidth: '36ch',
            }}
          >
            Wander. Savour. Belong.
          </p>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.large.size,
              lineHeight: 1.55,
              color: surface.soft,
              opacity: 0.92,
              margin: 0,
              marginBottom: theme.space.loose,
              maxWidth: '52ch',
            }}
          >
            From quiet Himalayan monasteries to the spice-warm streets of the south — twenty-eight
            states, a thousand stories, one journey, planned by an intelligence that understands how
            India is travelled.
          </p>

          <div
            style={{
              display: 'flex',
              gap: theme.space.comfy,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
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
            </a>

            {status === 'awaiting-activation' && (
              <button
                type="button"
                onClick={handleActivate}
                style={{
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: 'rgba(242, 232, 213, 0.12)',
                  border: `1px solid ${surface.whisper}`,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                aria-label="Enable ambient audio"
              >
                ◔ audio
              </button>
            )}
          </div>

          <FeaturedChips />
        </div>

        <ScrollIndicator />
      </section>

      {/* ─── STAT STRIP ───────────────────────────────────────────────── */}
      <StatStrip />

      {/* ─── ESPERIENZE ───────────────────────────────────────────────── */}
      <section
        id="esperienze"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-labelledby="experiences-heading"
      >
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: theme.space.hero }}>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                color: olive.deep,
                fontSize: 24,
                marginBottom: theme.space.tight,
              }}
            >
              ✦
            </span>
            <h2
              id="experiences-heading"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(36px, 4.5vw, 56px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontWeight: 600,
                margin: 0,
                color: ink.base,
              }}
            >
              Our experiences
            </h2>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.large.size,
                color: ink.soft,
                margin: `${theme.space.tight}px 0 0`,
              }}
            >
              Hand-curated journeys across India's twenty-eight states.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: theme.space.loose,
          }}
        >
          {EXPERIENCES.map((photo, idx) => {
            const label = EXPERIENCE_LABELS[idx]!;
            return (
              <Reveal key={photo.id} delay={idx * 90}>
                <Link
                  href="/aether/destinations"
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
                      borderRadius: theme.radius.lg,
                      overflow: 'hidden',
                      background: surface.soft,
                      boxShadow: theme.elevation.rest.shadow,
                      border: `1px solid ${ink.whisper}`,
                      transition:
                        'transform 320ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 320ms',
                      cursor: 'pointer',
                      height: '100%',
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
                    <div
                      style={{
                        aspectRatio: '4 / 3',
                        background: surface.deep,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={photoUrl(photo, 800)}
                        alt={photo.alt}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                        loading="lazy"
                      />
                    </div>
                    <div style={{ padding: theme.space.comfy }}>
                      <h3
                        style={{
                          fontFamily: theme.font.display,
                          fontSize: theme.text.subhead.size,
                          lineHeight: 1.25,
                          letterSpacing: '-0.01em',
                          fontWeight: 600,
                          margin: 0,
                          color: ink.base,
                        }}
                      >
                        {label.title}
                      </h3>
                      <p
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          lineHeight: 1.5,
                          color: ink.soft,
                          margin: `${theme.space.hairline}px 0 ${theme.space.comfy}px`,
                        }}
                      >
                        {label.subtitle}
                      </p>
                      <span
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          fontWeight: 600,
                          color: accent.deep,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {label.cta}
                      </span>
                    </div>
                  </article>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ─── REGIONS ──────────────────────────────────────────────────── */}
      <RegionsGrid />

      {/* ─── SWAAD BAND ───────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 600,
          overflow: 'hidden',
          background: olive.deep,
        }}
        aria-label="Swaad — taste of India"
      >
        <img
          src={photoUrl(GUSTARE, 2400)}
          alt={GUSTARE.alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.78,
          }}
          loading="lazy"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(42, 30, 24, 0.20) 0%,
              rgba(42, 30, 24, 0.62) 100%)`,
          }}
          aria-hidden
        />
        <Reveal>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 1280,
              margin: '0 auto',
              padding: `${theme.space.hero}px ${theme.space.margin}px`,
              color: surface.base,
              textAlign: 'center',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                fontSize: 30,
                marginBottom: theme.space.tight,
                color: ochre.glow,
              }}
            >
              ⌑
            </span>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(36px, 4.5vw, 60px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                margin: 0,
                fontWeight: 600,
                textShadow: '0 2px 14px rgba(24, 15, 11, 0.35)',
              }}
            >
              Swaad — a taste of India
            </h2>
            <p
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(18px, 2vw, 23px)',
                fontStyle: 'italic',
                lineHeight: 1.5,
                maxWidth: '46ch',
                margin: `${theme.space.comfy}px auto ${theme.space.loose}px`,
                color: surface.soft,
              }}
            >
              Spice routes, family recipes, and the people who have cooked them for centuries.
            </p>
            <Link
              href="/aether/journal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: `${theme.space.tight}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: surface.base,
                color: ink.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                boxShadow: theme.elevation.raised.shadow,
              }}
            >
              Read the journal
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ─── VOICES ───────────────────────────────────────────────────── */}
      <div id="voices">
        <Voices />
      </div>

      {/* ─── JOURNAL ──────────────────────────────────────────────────── */}
      <JournalPreview />

      {/* ─── TRUST SIGNALS ────────────────────────────────────────────── */}
      <section
        id="trust"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.hero}px ${theme.space.margin}px`,
          borderTop: `1px solid ${ink.whisper}`,
        }}
        aria-label="Why TravelSuperApp"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: theme.space.gutter,
          }}
        >
          {TRUST_SIGNALS.map((s, idx) => (
            <Reveal key={s.title} delay={idx * 80}>
              <div style={{ display: 'flex', gap: theme.space.comfy, alignItems: 'flex-start' }}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.pill,
                    background: accent.whisper,
                    color: accent.deep,
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </span>
                <div>
                  <h3
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.body.size,
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      lineHeight: 1.5,
                      color: ink.soft,
                      margin: `${theme.space.hairline}px 0 0`,
                    }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── EDITORIAL FOOTER ─────────────────────────────────────────── */}
      <EditorialFooter />
    </div>
  );
}
