'use client';

/**
 * <JourneyDashboard> — Aether-styled live view of a real trip.
 *
 * Fetches the trip via `useTripControllerGetOne`. Editorial composition:
 *   • Title block: huge display-serif title + status chip + date range
 *   • Facts strip: days · radius · created-on · last-edited
 *   • Stub itinerary card (Phase 1 wires to real itinerary endpoint)
 *   • Open-in-planner CTA → existing /trips/[id] surface
 *
 * Auth-gated. Loading + error states are calm + Aether-styled.
 */
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { useTripControllerGetOne, type TripDto } from '@app/sdk';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useViewport } from '../use-viewport';

export interface JourneyDashboardProps {
  tripId: string;
}

/** Coerce orval's odd nullable union types (TripDtoStartsOn etc.) into
 *  plain string | null. At runtime these fields are always ISO strings
 *  or null — the schema wrapper is a type-generation artefact. */
function asIso(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function fmtDate(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function JourneyDashboard({ tripId }: JourneyDashboardProps): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;

  // Only fetch once auth has settled (avoids a stampede of 401s on first
  // paint before the silent-refresh resolves).
  const query = useTripControllerGetOne(tripId, {
    query: { enabled: isAuthed, retry: 1 },
  });
  const trip = query.data?.data as TripDto | undefined;

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

      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.gutter}px`
            : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
      >
        {/* Auth-gated */}
        {bootComplete && !isAuthed && (
          <Reveal>
            <div
              style={{
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: ochre.whisper,
                border: `1px solid ${ochre.deep}`,
                fontFamily: theme.font.display,
                fontSize: 20,
                lineHeight: 1.5,
                color: ink.base,
              }}
            >
              This journey is private. Sign in to read it.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href={`/login?next=/aether/journey/${tripId}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: accent.base,
                    color: surface.base,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    textDecoration: 'none',
                  }}
                >
                  Sign in →
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Loading state */}
        {isAuthed && query.isPending && (
          <Reveal>
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
              Finding the journey…
            </div>
          </Reveal>
        )}

        {/* Error state */}
        {isAuthed && query.isError && (
          <Reveal>
            <div
              style={{
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: 'rgba(184, 58, 46, 0.08)',
                border: `1px solid rgba(184, 58, 46, 0.3)`,
                fontFamily: theme.font.display,
                fontSize: 20,
                lineHeight: 1.5,
                color: ink.base,
              }}
            >
              Couldn&apos;t open this journey. It may have been archived or never existed.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/aether/destinations"
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.body.size,
                    fontWeight: 600,
                    color: accent.deep,
                    textDecoration: 'none',
                  }}
                >
                  Browse destinations →
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Trip rendered */}
        {trip !== undefined && (
          <>
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
                Your journey · {trip.status}
              </p>
              <h1
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(40px, 6vw, 88px)',
                  lineHeight: 1.0,
                  letterSpacing: '-0.026em',
                  fontWeight: 600,
                  margin: 0,
                  color: ink.base,
                }}
              >
                {trip.title}
              </h1>
              {trip.archivedAt !== null && (
                <p
                  style={{
                    marginTop: theme.space.comfy,
                    display: 'inline-block',
                    padding: `4px 12px`,
                    borderRadius: theme.radius.pill,
                    background: ochre.whisper,
                    color: ink.base,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Archived · {fmtDate(trip.archivedAt)}
                </p>
              )}
            </Reveal>

            {/* Facts strip */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  border: `1px solid ${ink.whisper}`,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  overflow: 'hidden',
                }}
              >
                {[
                  {
                    label: 'Range',
                    value:
                      trip.startsOn !== null && trip.endsOn !== null
                        ? `${fmtDate(trip.startsOn)} – ${fmtDate(trip.endsOn)}`
                        : '—',
                  },
                  {
                    label: 'Days',
                    value:
                      daysBetween(trip.startsOn, trip.endsOn) !== null
                        ? String((daysBetween(trip.startsOn, trip.endsOn) ?? 0) + 1)
                        : '—',
                  },
                  { label: 'Radius', value: `${trip.radiusKm}km` },
                  { label: 'Drafted', value: fmtDate(trip.createdAt) },
                ].map((f, idx) => (
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
                        fontSize: 'clamp(18px, 1.8vw, 22px)',
                        lineHeight: 1.25,
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
            </Reveal>

            {/* Itinerary stub — Phase 1 wires to GET /trips/[id]/itinerary */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px dashed ${olive.deep}`,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: olive.deep,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: theme.space.tight,
                  }}
                >
                  Day-by-day · coming next
                </p>
                <h2
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(22px, 2.6vw, 32px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.014em',
                    fontWeight: 600,
                    margin: 0,
                    color: ink.base,
                  }}
                >
                  The intelligence is preparing your itinerary.
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
                  Open this journey in the full planner to read the day-by-day, swap places, adjust
                  pace, or add a host. The Aether dashboard shows the shape — the planner does the
                  edit.
                </p>
                <div style={{ display: 'flex', gap: theme.space.tight, flexWrap: 'wrap' }}>
                  <Link
                    href={`/trips/${tripId}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: `${theme.space.tight}px ${theme.space.loose}px`,
                      borderRadius: theme.radius.pill,
                      background: accent.base,
                      color: surface.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.button.size,
                      fontWeight: theme.text.button.weight,
                      textDecoration: 'none',
                      boxShadow: theme.elevation.raised.shadow,
                    }}
                  >
                    Open in the planner
                    <span aria-hidden>→</span>
                  </Link>
                  <Link
                    href="/aether/plan"
                    style={{
                      padding: `${theme.space.tight}px ${theme.space.loose}px`,
                      borderRadius: theme.radius.pill,
                      background: 'transparent',
                      color: ink.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.button.size,
                      fontWeight: theme.text.button.weight,
                      textDecoration: 'none',
                      border: `1px solid ${ink.whisper}`,
                    }}
                  >
                    Sketch another
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Footer meta */}
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
                  letterSpacing: '0.12em',
                  color: ink.soft,
                  opacity: 0.6,
                }}
              >
                <span>trip id · {tripId}</span>
                <span>
                  last edited · {fmtDate(trip.updatedAt)} · version {trip.version}
                </span>
              </div>
            </Reveal>
          </>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
