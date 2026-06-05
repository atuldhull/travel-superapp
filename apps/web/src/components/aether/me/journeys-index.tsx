'use client';

/**
 * <JourneysIndex> — the signed-in user's saved trips, Aether-styled.
 *
 * Listing of trips returned by `useTripControllerList`. Editorial
 * masthead + status filter chips (all / draft / archived) + a list
 * of trip rows, each clickable to /aether/journey/[id].
 *
 * Auth-gated identical to the Plan + Journey-Dashboard surfaces.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from '@app/aether-core';
import { type TripDto } from '@app/sdk';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
// AE355 — composite auth hook.
import { useAetherAuth } from '../use-aether-auth';
import { useViewport } from '../use-viewport';
// AE183 — trySeasonMatch moved to ./try-season-match.ts so it's testable.
import { trySeasonMatch } from './try-season-match';
// AE326 — shared fmtDate (was duplicated here + in dispatch/shares).
import { fmtDate } from '../../../lib/aether-dates';
// AE361 — shared 2-digit ordinal label.
import { ordinalLabel } from '../../../lib/ordinal-digits';
// AE362 — composite trip-list hook.
import { useAetherTripList } from '../use-aether-trip-list';

type ListFilter = 'all' | 'draft' | 'archived';

export function JourneysIndex(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  // AE355 — composite auth hook.
  const { bootComplete, isAuthed } = useAetherAuth();
  const [filter, setFilter] = useState<ListFilter>('all');

  // Active list (non-archived) + archived list — separate calls so the
  // toggle is instant.
  // AE362 — composite hook (folds orval call + tripsFromQuery into one).
  const activeQuery = useAetherTripList({
    archived: false,
    limit: '50',
    enabled: isAuthed,
  });
  const archivedQuery = useAetherTripList({
    archived: true,
    limit: '50',
    enabled: isAuthed && filter === 'archived',
  });
  const activeTrips = activeQuery.trips;
  const archivedTrips = archivedQuery.trips;

  // Apply the filter.
  const items: readonly TripDto[] =
    filter === 'archived'
      ? archivedTrips
      : filter === 'draft'
        ? activeTrips.filter((t) => t.status === 'draft')
        : activeTrips;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const FILTERS: ReadonlyArray<{ key: ListFilter; label: string }> = [
    { key: 'all', label: 'All journeys' },
    { key: 'draft', label: 'Drafts' },
    { key: 'archived', label: 'Archived' },
  ];

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
        {/* Masthead */}
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
            Your journeys · आपकी यात्राएँ
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 84px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
            }}
          >
            Every road you&apos;ve sketched.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.55,
              color: ink.soft,
              margin: `${theme.space.loose}px 0 0`,
              maxWidth: '54ch',
            }}
          >
            Drafts, in-flight plans, and the journeys you finished. Pick any to open the full
            editorial view, or start a new sketch.
          </p>
        </Reveal>

        {/* Auth wall */}
        {bootComplete && !isAuthed && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
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
              These journeys are private. Sign in to read them.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/login?next=/aether/me/journeys"
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

        {isAuthed && (
          <>
            {/* Filter chips + new-sketch CTA */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  marginBottom: theme.space.gutter,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.space.comfy,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.tight }}>
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
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
                          letterSpacing: '0.01em',
                          transition: 'background 220ms, border-color 220ms, color 220ms',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: theme.space.tight, flexWrap: 'wrap' }}>
                  <Link
                    href="/aether/me/shares"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                      borderRadius: theme.radius.pill,
                      background: 'transparent',
                      border: `1px solid ${ochre.deep}`,
                      color: ochre.deep,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Your shares
                  </Link>
                  <Link
                    href="/aether/plan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                      borderRadius: theme.radius.pill,
                      background: ink.base,
                      color: surface.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.button.size,
                      fontWeight: theme.text.button.weight,
                      textDecoration: 'none',
                    }}
                  >
                    Sketch another
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Loading state */}
            {(activeQuery.isPending || (filter === 'archived' && archivedQuery.isPending)) && (
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
                  Finding the journeys…
                </div>
              </Reveal>
            )}

            {/* Error state */}
            {(activeQuery.isError || (filter === 'archived' && archivedQuery.isError)) && (
              <Reveal>
                <div
                  style={{
                    marginTop: theme.space.comfy,
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: 'rgba(184, 58, 46, 0.08)',
                    border: `1px solid rgba(184, 58, 46, 0.3)`,
                    fontFamily: theme.font.display,
                    fontSize: 18,
                    color: ink.base,
                  }}
                >
                  Couldn&apos;t load your journeys. Try refreshing — the planner page still works.
                </div>
              </Reveal>
            )}

            {/* Empty state */}
            {!activeQuery.isPending && items.length === 0 && !activeQuery.isError && (
              <Reveal>
                <div
                  style={{
                    marginTop: theme.space.comfy,
                    padding: theme.space.hero,
                    borderRadius: theme.radius.lg,
                    background: surface.soft,
                    border: `1px dashed ${olive.deep}`,
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      fontSize: 22,
                      lineHeight: 1.5,
                      color: ink.soft,
                      margin: 0,
                      marginBottom: theme.space.comfy,
                    }}
                  >
                    {filter === 'archived'
                      ? 'No archived journeys yet.'
                      : filter === 'draft'
                        ? 'No drafts. Start a new one.'
                        : 'No journeys yet. The road waits.'}
                  </p>
                  <Link
                    href="/aether/plan"
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
                    Begin the yatra
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </Reveal>
            )}

            {/* Trip rows */}
            {items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((t, idx) => (
                  <Reveal key={t.id} delay={idx * 50}>
                    <Link
                      href={`/aether/journey/${t.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr auto',
                        alignItems: 'baseline',
                        gap: theme.space.comfy,
                        padding: `${theme.space.loose}px 0`,
                        borderBottom: `1px solid ${ink.whisper}`,
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background 200ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = surface.soft;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          fontFamily: theme.font.mono,
                          fontSize: 11,
                          letterSpacing: '0.16em',
                          color: olive.deep,
                        }}
                      >
                        {ordinalLabel(idx)}
                      </span>
                      <div>
                        <h3
                          style={{
                            fontFamily: theme.font.display,
                            fontSize: 'clamp(20px, 2.2vw, 28px)',
                            lineHeight: 1.2,
                            letterSpacing: '-0.014em',
                            fontWeight: 600,
                            margin: 0,
                            color: ink.base,
                          }}
                        >
                          {t.title}
                        </h3>
                        <div
                          style={{
                            marginTop: 4,
                            display: 'flex',
                            gap: theme.space.tight,
                            flexWrap: 'wrap',
                            fontFamily: theme.font.ui,
                            fontSize: 11,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: ink.soft,
                            opacity: 0.78,
                          }}
                        >
                          <span style={{ color: accent.deep, fontWeight: 600 }}>{t.status}</span>
                          <span aria-hidden>·</span>
                          <span>{t.radiusKm}km</span>
                          <span aria-hidden>·</span>
                          <span>edited {fmtDate(t.updatedAt)}</span>
                          {t.archivedAt !== null && (
                            <>
                              <span aria-hidden>·</span>
                              <span style={{ color: ochre.deep }}>archived</span>
                            </>
                          )}
                          {(() => {
                            const match = trySeasonMatch(t.title);
                            if (match === null) return null;
                            return (
                              <>
                                <span aria-hidden>·</span>
                                <span style={{ color: olive.deep, fontWeight: 600 }}>
                                  {match.name} in season
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          fontWeight: 600,
                          color: accent.deep,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Open →
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
