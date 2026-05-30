'use client';

/**
 * <SharedTripView> — Aether-styled read-only view of a publicly-shared
 * trip. Visitors can clone the journey to their own account (auth
 * required for clone, not for read). No edit affordances anywhere.
 *
 * Composition matches JourneyDashboard but stripped of mutations:
 *   • Eyebrow: "Shared by · {owner}"
 *   • Title block: huge display-serif title
 *   • Facts strip: range / days / radius / shared-on
 *   • Itinerary day cards (re-uses the JourneyDashboard editorial shape)
 *   • Clone CTA (auth-gated; signed-out routes to /login?next=...)
 */
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@app/aether-core';
import {
  useTripControllerCloneShared,
  useTripControllerGetSharedTrip,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type SharedTripDto,
  type TripDto,
} from '@app/sdk';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useViewport } from '../use-viewport';
import { TripShareCard } from '../journey/trip-share-card';

function asIso(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
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

function fmtDayHead(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const wk = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
}

function fmtTime(v: unknown): string | null {
  const s = asIso(v);
  if (s === null) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && s.length > 8) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (m === null) return null;
  const h = Number(m[1]);
  const mm = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${period}`;
}

function readSummaryField(
  summary: ItineraryDayDto['summary'],
  key: 'title' | 'subtitle' | 'theme' | 'note',
): string | null {
  if (summary === null) return null;
  const v = (summary as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function SharedTripView({ code }: { readonly code: string }): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;
  const [cloneError, setCloneError] = useState<string | null>(null);
  // AE82 — share-card preview toggle (re-share what we received).
  const [showShareCard, setShowShareCard] = useState<boolean>(false);

  const query = useTripControllerGetSharedTrip(code, { query: { retry: 1 } });
  const trip = query.data?.data as SharedTripDto | undefined;

  const cloneMutation = useTripControllerCloneShared({
    mutation: {
      onSuccess: (created: { data: TripDto }) => {
        setCloneError(null);
        router.push(`/aether/journey/${created.data.id}`);
      },
      onError: (err: unknown) => {
        setCloneError(err instanceof Error ? err.message : 'Could not clone this journey.');
      },
    },
  });

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
        {/* Loading */}
        {query.isPending && (
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
              Reading the shared journey…
            </div>
          </Reveal>
        )}

        {/* Error / not found */}
        {query.isError && (
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
              This link doesn&apos;t open anything. It may have been revoked, or never existed.
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

        {trip !== undefined && (
          <>
            {/* Eyebrow + title */}
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
                Shared by · {trip.ownerDisplayName}
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
              <p
                style={{
                  marginTop: theme.space.comfy,
                  display: 'inline-block',
                  padding: `4px 12px`,
                  borderRadius: theme.radius.pill,
                  background: olive.whisper,
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Read-only · you cannot edit
              </p>
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
                      asIso(trip.startsOn) !== null && asIso(trip.endsOn) !== null
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
                  { label: 'Shared', value: fmtDate(trip.createdAt) },
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

            {/* Clone CTA */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: ochre.whisper,
                  border: `1px solid ${ochre.deep}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: theme.space.comfy,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
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
                    Like this sketch?
                  </p>
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(20px, 2.4vw, 28px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.014em',
                      fontWeight: 600,
                      margin: `${theme.space.hairline}px 0 0`,
                      color: ink.base,
                    }}
                  >
                    Make it yours.
                  </p>
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      fontSize: 15,
                      lineHeight: 1.5,
                      color: ink.soft,
                      margin: `${theme.space.tight}px 0 0`,
                      maxWidth: '40ch',
                    }}
                  >
                    Cloning copies this journey into your account as a draft. The original stays
                    untouched.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCloneError(null);
                    if (!isAuthed) {
                      router.push(`/login?next=/aether/shared/${code}`);
                      return;
                    }
                    cloneMutation.mutate({ code });
                  }}
                  disabled={cloneMutation.isPending}
                  style={{
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: accent.base,
                    color: surface.base,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    border: 'none',
                    cursor: cloneMutation.isPending ? 'wait' : 'pointer',
                    opacity: cloneMutation.isPending ? 0.7 : 1,
                    boxShadow: theme.elevation.raised.shadow,
                  }}
                >
                  {cloneMutation.isPending
                    ? 'Cloning…'
                    : isAuthed
                      ? 'Clone this journey →'
                      : 'Sign in & clone →'}
                </button>
              </div>
              {cloneError !== null && (
                <p
                  role="alert"
                  style={{
                    marginTop: theme.space.tight,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    color: '#8a2418',
                  }}
                >
                  {cloneError}
                </p>
              )}
              {/* AE82 — re-share card */}
              <button
                type="button"
                onClick={() => setShowShareCard((v) => !v)}
                style={{
                  marginTop: theme.space.tight,
                  padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  border: `1px solid ${ochre.deep}`,
                  color: ochre.deep,
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
                aria-expanded={showShareCard}
              >
                {showShareCard ? 'Hide share card ▴' : 'Show share card ▾'}
              </button>
            </Reveal>

            {showShareCard && (
              <Reveal>
                <div style={{ marginTop: theme.space.gutter }}>
                  <TripShareCard trip={trip} />
                </div>
              </Reveal>
            )}

            {/* Day cards — same editorial shape as JourneyDashboard. */}
            {trip.days.length > 0 ? (
              <Reveal>
                <div style={{ marginTop: theme.space.hero }}>
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
                    Day by day · {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'}
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(28px, 3.4vw, 44px)',
                      lineHeight: 1.1,
                      letterSpacing: '-0.018em',
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.gutter,
                      color: ink.base,
                    }}
                  >
                    Their shape of the road.
                  </h2>
                  <ol
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: theme.space.comfy,
                    }}
                  >
                    {trip.days.map((day) => {
                      const dayNumber = day.dayIndex + 1;
                      const title = readSummaryField(day.summary, 'title');
                      const subtitle =
                        readSummaryField(day.summary, 'subtitle') ??
                        readSummaryField(day.summary, 'theme');
                      const items = [...day.items].sort(
                        (a: ItineraryItemDto, b: ItineraryItemDto) => a.position - b.position,
                      );
                      return (
                        <li
                          key={day.id}
                          style={{
                            padding: theme.space.loose,
                            borderRadius: theme.radius.lg,
                            background: surface.soft,
                            border: `1px solid ${olive.whisper}`,
                            display: 'grid',
                            gridTemplateColumns: isNarrow ? '1fr' : '88px 1fr',
                            gap: theme.space.comfy,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: theme.font.display,
                              fontSize: isNarrow ? 28 : 56,
                              lineHeight: 1,
                              letterSpacing: '-0.02em',
                              fontWeight: 600,
                              color: accent.deep,
                              textAlign: isNarrow ? 'left' : 'right',
                            }}
                          >
                            {String(dayNumber).padStart(2, '0')}
                          </div>
                          <div>
                            <p
                              style={{
                                fontFamily: theme.font.ui,
                                fontSize: 11,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: ink.soft,
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              Day {dayNumber} · {fmtDayHead(day.date)}
                            </p>
                            <h3
                              style={{
                                fontFamily: theme.font.display,
                                fontSize: 'clamp(22px, 2.4vw, 30px)',
                                lineHeight: 1.2,
                                letterSpacing: '-0.014em',
                                fontWeight: 600,
                                margin: `${theme.space.hairline}px 0 0`,
                                color: ink.base,
                              }}
                            >
                              {title ?? 'A quiet day in the journey.'}
                            </h3>
                            {subtitle !== null && (
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
                                {subtitle}
                              </p>
                            )}
                            {items.length > 0 && (
                              <ul
                                style={{
                                  listStyle: 'none',
                                  padding: 0,
                                  margin: `${theme.space.comfy}px 0 0`,
                                  display: 'grid',
                                  gap: theme.space.hairline,
                                }}
                              >
                                {items.map((item) => {
                                  const start = fmtTime(item.startTime);
                                  const end = fmtTime(item.endTime);
                                  const noteText = asIso(item.notes);
                                  return (
                                    <li
                                      key={item.id}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: '76px 1fr',
                                        gap: theme.space.tight,
                                        fontFamily: theme.font.ui,
                                        fontSize: theme.text.body.size,
                                        lineHeight: 1.5,
                                        color: ink.base,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontFamily: theme.font.mono,
                                          fontSize: 11,
                                          letterSpacing: '0.06em',
                                          color: ink.soft,
                                          paddingTop: 2,
                                        }}
                                      >
                                        {start ?? '—'}
                                        {end !== null && start !== null ? ` · ${end}` : ''}
                                      </span>
                                      <span>{noteText ?? 'Movement, with no script.'}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </Reveal>
            ) : (
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
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      fontSize: 18,
                      lineHeight: 1.5,
                      color: ink.soft,
                      margin: 0,
                    }}
                  >
                    The owner hasn&apos;t sketched the days yet. The shape is here; the detail is
                    not.
                  </p>
                </div>
              </Reveal>
            )}
          </>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
