'use client';

/**
 * <PlanPage> — the Aether trip-planner entry surface (Phase 0 stub).
 *
 * Two-column composition:
 *   • Left: editorial intro + the three-question form ("where to" /
 *     "when" / "what kind"). On submit, Phase 0 just shows a
 *     confirmation card — Phase 1 wires this to the existing
 *     trip-planner backend (`apiFetch` to `POST /trips/draft` or
 *     similar). For now the form proves the surface end-to-end.
 *   • Right: a stack of "recently sketched" trip cards — hand-curated
 *     itineraries with destination + duration + pace summary, each
 *     linking back to the relevant destination detail.
 *
 * Reachable from every Begin-the-yatra CTA, every destination's final
 * call-to-action, the AboutPage's bottom CTA, and the Drift hero
 * pill.
 */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';

interface SketchedTrip {
  readonly slug: string;
  readonly destination: string;
  readonly days: number;
  readonly pace: string;
  readonly tagline: string;
}

const SKETCHES: readonly SketchedTrip[] = [
  {
    slug: 'jaipur',
    destination: 'Jaipur',
    days: 5,
    pace: 'Heritage & craft',
    tagline: 'Forts at dawn, block-printing studios after.',
  },
  {
    slug: 'alleppey',
    destination: 'Alleppey',
    days: 2,
    pace: 'Slow water',
    tagline: 'Houseboat overnight, two long meals, no plans.',
  },
  {
    slug: 'leh',
    destination: 'Leh',
    days: 7,
    pace: 'Acclimatise · meditate',
    tagline: 'Monasteries, a pass, a lake, and time.',
  },
];

const PACE_OPTIONS = ['Slow & deep', 'Balanced', 'Many places, fast'] as const;
const KIND_OPTIONS = ['Heritage', 'Mountains', 'Coast', 'Food', 'Spiritual'] as const;

export function PlanPage(): React.ReactElement {
  const theme = useTheme();
  const [destination, setDestination] = useState<string>('');
  const [when, setWhen] = useState<string>('');
  const [pace, setPace] = useState<(typeof PACE_OPTIONS)[number]>('Balanced');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>('Heritage');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSubmitted(true);
    // Phase 1 wires to the real backend.
  };

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

      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: theme.space.hero,
            alignItems: 'start',
          }}
        >
          {/* Left column — intro + form */}
          <Reveal>
            <div>
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
                Begin a yatra
              </p>
              <h1
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(42px, 5.8vw, 76px)',
                  lineHeight: 1.0,
                  letterSpacing: '-0.026em',
                  fontWeight: 600,
                  margin: 0,
                  color: ink.base,
                  maxWidth: '14ch',
                }}
              >
                Tell us three things.
              </h1>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 'clamp(18px, 2vw, 23px)',
                  lineHeight: 1.55,
                  color: ink.soft,
                  margin: `${theme.space.comfy}px 0 ${theme.space.loose}px`,
                  maxWidth: '40ch',
                }}
              >
                Then sit back while the intelligence sketches your first draft. Refine, swap, or
                start over — nothing is committed until you say so.
              </p>

              {submitted ? (
                <div
                  style={{
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: ochre.whisper,
                    border: `1px solid ${ochre.deep}`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: accent.deep,
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    Sketch queued
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(22px, 2.4vw, 30px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.014em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {destination !== '' ? destination : 'Your journey'} · {pace.toLowerCase()} ·{' '}
                    {kind.toLowerCase()}
                  </h2>
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      fontSize: 17,
                      lineHeight: 1.55,
                      color: ink.soft,
                      margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
                    }}
                  >
                    We&apos;re reading your three answers. A full draft itinerary will land in your
                    inbox within an hour — and on this surface, the moment you sign in.
                  </p>
                  <div style={{ display: 'flex', gap: theme.space.tight, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      style={{
                        padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                        borderRadius: theme.radius.pill,
                        background: 'transparent',
                        color: ink.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        fontWeight: 600,
                        border: `1px solid ${ink.whisper}`,
                        cursor: 'pointer',
                      }}
                    >
                      Sketch another
                    </button>
                    <Link
                      href="/aether/destinations"
                      style={{
                        padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                        borderRadius: theme.radius.pill,
                        background: accent.base,
                        color: surface.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Browse destinations →
                    </Link>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: theme.space.loose }}
                >
                  {/* Where */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                      }}
                    >
                      01 · Where
                    </span>
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="A place name, a state, or a feeling"
                      style={{
                        padding: `${theme.space.comfy}px ${theme.space.inline}px`,
                        borderRadius: theme.radius.md,
                        border: `1px solid ${ink.whisper}`,
                        background: surface.soft,
                        color: ink.base,
                        fontFamily: theme.font.display,
                        fontSize: 22,
                        lineHeight: 1.2,
                        outline: 'none',
                      }}
                    />
                  </label>

                  {/* When */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                      }}
                    >
                      02 · When
                    </span>
                    <input
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      placeholder="A month, a season, or 'flexible'"
                      style={{
                        padding: `${theme.space.comfy}px ${theme.space.inline}px`,
                        borderRadius: theme.radius.md,
                        border: `1px solid ${ink.whisper}`,
                        background: surface.soft,
                        color: ink.base,
                        fontFamily: theme.font.display,
                        fontSize: 22,
                        lineHeight: 1.2,
                        outline: 'none',
                      }}
                    />
                  </label>

                  {/* Pace */}
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      03 · Pace
                    </legend>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.tight }}>
                      {PACE_OPTIONS.map((p) => {
                        const active = pace === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPace(p)}
                            style={{
                              padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                              borderRadius: theme.radius.pill,
                              border: `1px solid ${active ? accent.base : ink.whisper}`,
                              background: active ? accent.base : 'transparent',
                              color: active ? surface.base : ink.base,
                              fontFamily: theme.font.ui,
                              fontSize: theme.text.small.size,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Kind */}
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      Also · what kind
                    </legend>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.tight }}>
                      {KIND_OPTIONS.map((k) => {
                        const active = kind === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKind(k)}
                            style={{
                              padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                              borderRadius: theme.radius.pill,
                              border: `1px solid ${active ? olive.deep : ink.whisper}`,
                              background: active ? olive.deep : 'transparent',
                              color: active ? surface.base : ink.base,
                              fontFamily: theme.font.ui,
                              fontSize: theme.text.small.size,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <button
                    type="submit"
                    style={{
                      marginTop: theme.space.tight,
                      padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                      borderRadius: theme.radius.pill,
                      background: ink.base,
                      color: surface.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.button.size,
                      fontWeight: theme.text.button.weight,
                      border: 'none',
                      cursor: 'pointer',
                      alignSelf: 'flex-start',
                      letterSpacing: '0.01em',
                      boxShadow: theme.elevation.raised.shadow,
                    }}
                  >
                    Sketch the journey →
                  </button>
                </form>
              )}
            </div>
          </Reveal>

          {/* Right column — recently sketched */}
          <Reveal delay={120}>
            <div>
              <h2
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(22px, 2.4vw, 28px)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.014em',
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: theme.space.loose,
                  color: ink.base,
                }}
              >
                Recently sketched
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.comfy }}>
                {SKETCHES.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/aether/destinations/${s.slug}`}
                    style={{
                      padding: theme.space.loose,
                      borderRadius: theme.radius.lg,
                      background: surface.soft,
                      border: `1px solid ${ink.whisper}`,
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      transition:
                        'transform 220ms cubic-bezier(0.42, 0, 0.18, 1), border-color 220ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = accent.base;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = ink.whisper;
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: theme.space.comfy,
                      }}
                    >
                      <h3
                        style={{
                          fontFamily: theme.font.display,
                          fontSize: 26,
                          fontWeight: 600,
                          letterSpacing: '-0.014em',
                          margin: 0,
                          color: ink.base,
                        }}
                      >
                        {s.destination}
                      </h3>
                      <span
                        style={{
                          fontFamily: theme.font.mono,
                          fontSize: 11,
                          letterSpacing: '0.14em',
                          color: ink.soft,
                          opacity: 0.78,
                        }}
                      >
                        {s.days} days
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: accent.deep,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      {s.pace}
                    </div>
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 17,
                        lineHeight: 1.5,
                        color: ink.soft,
                        margin: `${theme.space.tight}px 0 0`,
                      }}
                    >
                      {s.tagline}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <EditorialFooter />
    </div>
  );
}
