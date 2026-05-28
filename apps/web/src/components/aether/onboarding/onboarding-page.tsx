'use client';

/**
 * <OnboardingPage> — the editorial first-time welcome.
 *
 * Three soft sections:
 *   1. Hero — full-bleed photograph, kicker, big serif title, lede,
 *      pacing dots showing 1·2·3.
 *   2. What we believe — three condensed beliefs from About, each
 *      a short italic-serif paragraph with an ochre numeral cap.
 *   3. Begin your first yatra — terracotta CTA pre-filling /aether/plan
 *      + a small "Skip · explore on my own" link to /aether/drift.
 *
 * On mount: marks `aether-onboarded=1` in localStorage so the DriftNav
 * (and any future banner) stops pointing here. We mark on mount, not
 * on completion, because the surface itself counts as "seen". Users
 * can re-visit /aether/onboarding directly any time.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useMotionPolicy, useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useParallax } from '../use-parallax';
import { useViewport } from '../use-viewport';
import { HERO_CAROUSEL, photoUrl, creditUrl } from '../photos';

const BELIEFS: ReadonlyArray<{ numeral: string; title: string; body: string }> = [
  {
    numeral: '01',
    title: 'Slow over speed.',
    body: 'The road has a tempo. We refuse to optimise it away — a quiet morning is a feature, not a bug.',
  },
  {
    numeral: '02',
    title: 'Place over checklist.',
    body: 'A yatra is not a list of pins. It is a string of moments — a chai stall, a song from a courtyard, a corner you almost missed.',
  },
  {
    numeral: '03',
    title: 'Yours, not the algorithm’s.',
    body: 'The AI sketches; you decide. Every itinerary is a draft you can refuse, refine, or rewrite. We answer to your road, not to engagement metrics.',
  },
];

export function OnboardingPage(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  const heroImgRef = useParallax<HTMLImageElement>({ speed: 0.28, maxOffset: 180 });

  // First-paint mark — the moment the surface renders, the user is
  // "onboarded" enough that the entry banner doesn't need to nudge.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('aether-onboarded', '1');
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const hero = HERO_CAROUSEL[0] ?? HERO_CAROUSEL[0]!;

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
          height: 'min(86vh, 760px)',
          overflow: 'hidden',
          background: ink.deep,
        }}
        aria-label="Welcome to Aether"
      >
        <img
          ref={heroImgRef}
          src={photoUrl(hero, 2400)}
          alt={hero.alt}
          style={{
            position: 'absolute',
            inset: '-8% 0',
            width: '100%',
            height: '116%',
            objectFit: 'cover',
            transform: motionPolicy === 'full' ? 'scale(1.04)' : 'none',
            transformOrigin: '50% 55%',
            transition: 'transform 26s cubic-bezier(0.42, 0, 0.18, 1)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(24, 15, 11, 0.20) 0%,
              rgba(24, 15, 11, 0.05) 30%,
              rgba(24, 15, 11, 0.65) 100%)`,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1080,
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
            Welcome to Aether · नमस्ते
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(48px, 7.6vw, 108px)',
              lineHeight: 0.98,
              letterSpacing: '-0.028em',
              fontWeight: 600,
              margin: 0,
              maxWidth: '14ch',
              textShadow: '0 2px 32px rgba(24, 15, 11, 0.45)',
            }}
          >
            Slow travel, sketched by AI.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(20px, 2.4vw, 30px)',
              lineHeight: 1.4,
              letterSpacing: '-0.012em',
              color: surface.soft,
              maxWidth: '40ch',
              margin: `${theme.space.comfy}px 0 ${theme.space.loose}px`,
            }}
          >
            Three breaths and you&apos;re moving — what we believe, what to expect, and a way in.
          </p>
          {/* Pacing dots — 1·2·3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.tight,
              fontFamily: theme.font.mono,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: surface.soft,
              opacity: 0.78,
            }}
          >
            <span style={{ color: accent.deep, fontWeight: 600 }}>01 hero</span>
            <span aria-hidden>·</span>
            <span>02 beliefs</span>
            <span aria-hidden>·</span>
            <span>03 begin</span>
          </div>
        </div>

        {/* Photographer credit */}
        <a
          href={creditUrl(hero)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Photo by ${hero.by} on Unsplash`}
          style={{
            position: 'absolute',
            right: isNarrow ? theme.space.comfy : theme.space.gutter,
            bottom: isNarrow ? theme.space.comfy : theme.space.gutter,
            zIndex: 2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: theme.radius.pill,
            background: 'rgba(24, 15, 11, 0.42)',
            color: surface.soft,
            fontFamily: theme.font.ui,
            fontSize: 11,
            letterSpacing: '0.08em',
            textDecoration: 'none',
            opacity: 0.78,
          }}
        >
          <span aria-hidden style={{ color: ochre.glow }}>
            ◐
          </span>
          <span style={{ fontWeight: 600, color: surface.base }}>{hero.by}</span>
          <span style={{ opacity: 0.72 }}>· Unsplash</span>
        </a>
      </section>

      {/* ─── WHAT WE BELIEVE ─────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px`
            : `${theme.space.hero}px ${theme.space.margin}px`,
        }}
        aria-labelledby="onboarding-beliefs"
      >
        <Reveal>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            02 · what we believe
          </p>
          <h2
            id="onboarding-beliefs"
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(34px, 4.5vw, 60px)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              fontWeight: 600,
              margin: 0,
              maxWidth: '20ch',
            }}
          >
            Three things, then we&apos;ll get out of your way.
          </h2>
        </Reveal>

        <div
          style={{
            marginTop: theme.space.hero,
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
            gap: theme.space.gutter,
          }}
        >
          {BELIEFS.map((b, idx) => (
            <Reveal key={b.numeral} delay={idx * 80}>
              <div>
                <div
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 44,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontWeight: 600,
                    color: ochre.deep,
                  }}
                >
                  {b.numeral}
                </div>
                <h3
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(22px, 2.4vw, 30px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.014em',
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 0`,
                    color: ink.base,
                  }}
                >
                  {b.title}
                </h3>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 17,
                    lineHeight: 1.6,
                    color: ink.soft,
                    margin: `${theme.space.comfy}px 0 0`,
                  }}
                >
                  {b.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── BEGIN ───────────────────────────────────────────────────── */}
      <section
        style={{
          background: olive.whisper,
          borderTop: `1px solid ${olive.deep}`,
          borderBottom: `1px solid ${olive.deep}`,
        }}
        aria-labelledby="onboarding-begin"
      >
        <Reveal>
          <div
            style={{
              maxWidth: 1080,
              margin: '0 auto',
              padding: isNarrow
                ? `${theme.space.hero}px ${theme.space.comfy}px`
                : `${theme.space.hero}px ${theme.space.margin}px`,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: accent.deep,
                fontWeight: 600,
                margin: 0,
              }}
            >
              03 · begin
            </p>
            <h2
              id="onboarding-begin"
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(34px, 4.6vw, 62px)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                fontWeight: 600,
                margin: `${theme.space.tight}px 0 0`,
                color: ink.base,
              }}
            >
              Your first yatra.
            </h2>
            <p
              style={{
                fontFamily: theme.font.display,
                fontStyle: 'italic',
                fontSize: 'clamp(18px, 2vw, 22px)',
                lineHeight: 1.5,
                color: ink.soft,
                margin: `${theme.space.comfy}px auto 0`,
                maxWidth: '44ch',
              }}
            >
              Tell the model a place. Or just a mood — &quot;quiet, near the sea&quot;. We&apos;ll
              do the rest.
            </p>
            <div
              style={{
                marginTop: theme.space.loose,
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
                href="/aether/drift"
                style={{
                  padding: `${theme.space.tight}px ${theme.space.loose}px`,
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  color: ink.soft,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: `1px solid ${ink.whisper}`,
                }}
              >
                Skip · explore on my own
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <EditorialFooter />
    </div>
  );
}
