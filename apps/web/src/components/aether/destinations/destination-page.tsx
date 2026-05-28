'use client';

/**
 * <DestinationPage> — editorial layout for a single destination.
 *
 * Composition:
 *   • DriftNav (transparent → glass-cream on scroll)
 *   • Hero — full-bleed photo + state kicker + huge serif name + tagline
 *   • Facts strip — season / pace / budget
 *   • Lede — single long-form paragraph in display serif
 *   • Moments grid — 5 small editorial cards (2-3 column responsive)
 *   • Itinerary cards — 3 timing options
 *   • Footer (EditorialFooter)
 *
 * Identical motion + audio respect as Drift. Lives inside DriftShell's
 * AetherProvider (mounted by the route page).
 */
import Link from 'next/link';
import { useMotionPolicy, useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useParallax } from '../use-parallax';
import { photoUrl } from '../photos';
import { SafeImg } from '../safe-img';
import { type Destination } from './data';

export interface DestinationPageProps {
  destination: Destination;
}

export function DestinationPage({ destination: d }: DestinationPageProps): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const heroImgRef = useParallax<HTMLImageElement>({ speed: 0.28, maxOffset: 180 });

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
          height: 'min(82vh, 720px)',
          overflow: 'hidden',
          background: ink.deep,
        }}
        aria-label={`${d.name} hero`}
      >
        <img
          ref={heroImgRef}
          src={photoUrl(d.hero, 2400)}
          alt={d.hero.alt}
          style={{
            position: 'absolute',
            inset: '-8% 0',
            width: '100%',
            height: '116%',
            objectFit: 'cover',
            transform: motionPolicy === 'full' ? 'scale(1.04)' : 'none',
            transformOrigin: '50% 55%',
            transition: 'transform 26s cubic-bezier(0.42, 0, 0.18, 1)',
            willChange: motionPolicy === 'full' ? 'transform' : 'auto',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, rgba(24, 15, 11, 0.20) 0%, rgba(24, 15, 11, 0.10) 30%, rgba(24, 15, 11, 0.65) 100%)`,
          }}
        />
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
            paddingBottom: theme.space.hero,
            color: surface.base,
          }}
        >
          <Link
            href="/aether/drift"
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: ochre.glow,
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: theme.space.tight,
            }}
          >
            ← Aether · {d.state}
          </Link>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(56px, 9vw, 132px)',
              lineHeight: 0.96,
              letterSpacing: '-0.03em',
              fontWeight: 600,
              margin: 0,
              maxWidth: '12ch',
              textShadow: '0 2px 32px rgba(24, 15, 11, 0.45)',
            }}
          >
            {d.name}.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(20px, 2vw, 28px)',
              fontStyle: 'italic',
              lineHeight: 1.35,
              letterSpacing: '-0.012em',
              maxWidth: '44ch',
              margin: `${theme.space.comfy}px 0 0`,
              color: surface.soft,
            }}
          >
            {d.tagline}
          </p>
        </div>
      </section>

      {/* ─── FACTS STRIP ──────────────────────────────────────────────── */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.gutter}px ${theme.space.margin}px`,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              border: `1px solid ${ink.whisper}`,
              borderRadius: theme.radius.lg,
              background: surface.soft,
              overflow: 'hidden',
            }}
          >
            {d.facts.map((f, idx) => (
              <div
                key={f.label}
                style={{
                  padding: `${theme.space.loose}px ${theme.space.comfy}px`,
                  borderLeft: idx > 0 ? `1px solid ${ink.whisper}` : 'none',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: ink.soft,
                    fontWeight: 600,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(20px, 2vw, 26px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.012em',
                    fontWeight: 600,
                    color: ink.base,
                    marginTop: 6,
                  }}
                >
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ─── LEDE ─────────────────────────────────────────────────────── */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'block',
              fontSize: 28,
              color: olive.deep,
              marginBottom: theme.space.comfy,
            }}
          >
            ✦
          </span>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(20px, 2.1vw, 27px)',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
              color: ink.base,
              margin: 0,
            }}
          >
            {d.lede}
          </p>
        </div>
      </Reveal>

      {/* ─── MOMENTS ──────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-labelledby="moments-heading"
      >
        <Reveal>
          <h2
            id="moments-heading"
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
            Five moments worth flying for
          </h2>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: theme.space.loose,
          }}
        >
          {d.moments.map((m, idx) => (
            <Reveal key={m.title} delay={idx * 80}>
              <article
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  background: surface.soft,
                  border: `1px solid ${ink.whisper}`,
                  height: '100%',
                }}
              >
                <div style={{ aspectRatio: '3 / 2', background: surface.deep }}>
                  <SafeImg
                    src={photoUrl(m.photo, 700)}
                    alt={m.photo.alt}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ padding: theme.space.comfy }}>
                  <div
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: accent.deep,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')} · Moment
                  </div>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 22,
                      lineHeight: 1.25,
                      letterSpacing: '-0.012em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {m.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      lineHeight: 1.55,
                      color: ink.soft,
                      margin: `${theme.space.tight}px 0 0`,
                    }}
                  >
                    {m.body}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── ITINERARIES ──────────────────────────────────────────────── */}
      <section
        style={{
          background: surface.soft,
          borderTop: `1px solid ${ink.whisper}`,
          borderBottom: `1px solid ${ink.whisper}`,
        }}
        aria-labelledby="itin-heading"
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
          }}
        >
          <Reveal>
            <h2
              id="itin-heading"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.tight,
                color: ink.base,
              }}
            >
              Three ways to do it
            </h2>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.large.size,
                color: ink.soft,
                margin: 0,
                marginBottom: theme.space.gutter,
              }}
            >
              Pick the timing that fits. The intelligence picks the rest.
            </p>
          </Reveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: theme.space.gutter,
            }}
          >
            {d.itineraries.map((it, idx) => (
              <Reveal key={it.name} delay={idx * 100}>
                <article
                  style={{
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: surface.base,
                    border: `1px solid ${ink.whisper}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.space.tight,
                    height: '100%',
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
                    }}
                  >
                    {it.days} days · option {String.fromCharCode(65 + idx)}
                  </div>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 26,
                      lineHeight: 1.2,
                      letterSpacing: '-0.012em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {it.name}
                  </h3>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.body.size,
                      lineHeight: 1.55,
                      color: ink.soft,
                      margin: 0,
                      flexGrow: 1,
                    }}
                  >
                    {it.lede}
                  </p>
                  <Link
                    href="/home"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: theme.space.tight,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      fontWeight: 600,
                      color: accent.deep,
                      textDecoration: 'none',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Plan this with AI →
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────── */}
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
            Ready to wander {d.name}?
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
            Two minutes with the planner gets you a draft. Refine from there.
          </p>
          <Link
            href="/home"
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
        </div>
      </Reveal>

      <EditorialFooter />
    </div>
  );
}
