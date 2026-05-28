'use client';

/**
 * <PlanPage> — the Aether trip-planner entry surface, wired to backend.
 *
 * Two-column composition:
 *   • Left: editorial intro + the three-question form (Where / When /
 *     Pace / Kind). On submit, calls `useTripControllerCreate` against
 *     `POST /trips` with the entered title + a default-Jaipur center
 *     (geocoding lands Phase 1) + pace/kind appended to the title.
 *     Auth-gated: if not signed in, the submit button becomes a
 *     'Sign in to sketch' link to /login?next=/aether/plan.
 *     On success, navigates to the existing /trips/[id] surface so
 *     the user lands in the planner with their new draft live.
 *   • Right: 3 'Recently sketched' editorial trip cards linking to
 *     destination details.
 *
 * Reachable from every Begin-the-yatra CTA across the Aether surface.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useTheme } from '@app/aether-core';
import { useTripControllerCreate, type TripDto } from '@app/sdk';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { geocodeOne } from '../../../lib/geocode';

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

/** Fallback center used when Photon misses on the freeform 'Where'
 *  (typo, blank, exotic abbreviation). Picked Jaipur — a sensible
 *  starting point for first-time India travellers + middle of the
 *  country geographically. */
const DEFAULT_CENTER = { lat: 26.9124, lng: 75.7873 } as const;
const DEFAULT_RADIUS_KM = 50;

export function PlanPage(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;
  const createTrip = useTripControllerCreate({
    mutation: {
      onSuccess: (created: TripDto) => {
        // Created.id present on the response per CreateTripRequestDto schema.
        router.push(`/trips/${created.id}`);
      },
    },
  });

  const [destination, setDestination] = useState<string>('');
  const [when, setWhen] = useState<string>('');
  const [pace, setPace] = useState<(typeof PACE_OPTIONS)[number]>('Balanced');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>('Heritage');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isAuthed) {
      // Bounce to login with a return-here next-param.
      router.push('/login?next=/aether/plan');
      return;
    }

    const trimmedDest = destination.trim();
    const trimmedWhen = when.trim();
    // Title rolls the four answers into one human-readable string. The
    // existing /trips/[id] surface shows this prominently.
    const title =
      `${trimmedDest !== '' ? trimmedDest : kind} · ${pace.toLowerCase()}` +
      (trimmedWhen !== '' ? ` · ${trimmedWhen}` : '');

    setSubmitted(true);

    // Geocode the 'Where' field — Photon (komoot) → Nominatim fallback,
    // both keyless. Always resolves (never throws); falls through to
    // Jaipur default on miss + on empty input.
    let center: { lat: number; lng: number } = DEFAULT_CENTER;
    if (trimmedDest !== '') {
      const hit = await geocodeOne(trimmedDest, 'India', DEFAULT_CENTER);
      if (hit !== null) {
        center = { lat: hit.lat, lng: hit.lng };
      }
    }

    createTrip.mutate(
      {
        data: {
          title,
          center,
          radiusKm: DEFAULT_RADIUS_KM,
        },
      },
      {
        onError: (err: unknown) => {
          setSubmitted(false);
          const message =
            err instanceof Error
              ? err.message
              : 'Something went wrong sketching the trip. Try again.';
          setErrorMsg(message);
        },
      },
    );
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
                    {createTrip.isPending ? 'Sketching…' : 'Sketch queued'}
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
                    {createTrip.isPending
                      ? 'Drafting your trip on the server. This takes a few seconds — we redirect the moment it lands.'
                      : 'Your draft is saved. You can refine it on the trip page or sketch another below.'}
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
                  onSubmit={(e) => void handleSubmit(e)}
                  style={{ display: 'flex', flexDirection: 'column', gap: theme.space.loose }}
                >
                  {errorMsg !== null && (
                    <div
                      role="alert"
                      style={{
                        padding: theme.space.comfy,
                        borderRadius: theme.radius.md,
                        background: 'rgba(184, 58, 46, 0.08)',
                        border: `1px solid rgba(184, 58, 46, 0.3)`,
                        color: '#8a2418',
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        lineHeight: 1.5,
                      }}
                    >
                      {errorMsg}
                    </div>
                  )}

                  {!isAuthed && bootComplete && (
                    <div
                      style={{
                        padding: theme.space.comfy,
                        borderRadius: theme.radius.md,
                        background: ochre.whisper,
                        border: `1px solid ${ochre.deep}`,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        color: ink.base,
                        lineHeight: 1.55,
                      }}
                    >
                      You&apos;ll be asked to sign in before the sketch saves. Drafts live in your
                      account so you can come back to them.
                    </div>
                  )}

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
                      cursor: createTrip.isPending ? 'wait' : 'pointer',
                      alignSelf: 'flex-start',
                      letterSpacing: '0.01em',
                      boxShadow: theme.elevation.raised.shadow,
                      opacity: createTrip.isPending ? 0.7 : 1,
                    }}
                    disabled={createTrip.isPending}
                  >
                    {createTrip.isPending
                      ? 'Sketching…'
                      : isAuthed
                        ? 'Sketch the journey →'
                        : 'Sign in & sketch →'}
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
