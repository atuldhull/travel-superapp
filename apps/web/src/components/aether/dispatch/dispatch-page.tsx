'use client';

/**
 * <DispatchPage> — admin-only Aether dispatch / ops view.
 *
 * Sections:
 *   • Hero: "Dispatch" + ops eyebrow + role gate.
 *   • Aggregate stats — total trips, drafts, archived, share-codes-active.
 *   • Recent trips — last 10 active drafts, linkable to /aether/journey/[id]
 *     for quick eyeball checks during the preview.
 *   • Recent archived — last 5 archived (helps spot sweeps).
 *
 * Gating: requires `me.role === 'admin'`. Non-admin auth'd users see
 * a calm "not authorised" message rather than a hard 403.
 */
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import {
  useAuthControllerMe,
  useTripControllerList,
  type TripDto,
  type WhoAmIResponseDto,
} from '@app/sdk';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useViewport } from '../use-viewport';

// AE326 — shared fmtDate (was duplicated here + in journeys/shares).
import { fmtDate } from '../../../lib/aether-dates';
// AE339 — shared trip-stats summariser (same predicate as me-home).
import { summariseTripStats } from '../me/trip-stats-summary';

export function DispatchPage(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;

  const meQuery = useAuthControllerMe({ query: { enabled: isAuthed, retry: 1 } });
  const me = meQuery.data?.data as WhoAmIResponseDto | undefined;
  const isAdmin = me?.role === 'admin';

  // We over-fetch (100 of each) — admin volume is tiny by definition.
  const activeQuery = useTripControllerList(
    { limit: '100', archived: 'false' },
    { query: { enabled: isAuthed && isAdmin } },
  );
  const archivedQuery = useTripControllerList(
    { limit: '100', archived: 'true' },
    { query: { enabled: isAuthed && isAdmin } },
  );

  const activeTrips = (activeQuery.data?.data as { trips?: TripDto[] } | undefined)?.trips ?? [];
  const archivedTrips =
    (archivedQuery.data?.data as { trips?: TripDto[] } | undefined)?.trips ?? [];
  // AE339 — drafts predicate shared with /me.
  const { drafts } = summariseTripStats({ active: activeTrips, archived: archivedTrips });

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
            Ops · dispatch · {me?.role ?? 'guest'}
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
            What the road is doing.
          </h1>
        </Reveal>

        {/* Auth + role gate */}
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
                color: ink.base,
              }}
            >
              Dispatch is admin-only. Sign in first.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/login?next=/aether/dispatch"
                  style={{
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

        {isAuthed && me !== undefined && !isAdmin && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: 'rgba(184, 58, 46, 0.06)',
                border: `1px solid rgba(184, 58, 46, 0.3)`,
                fontFamily: theme.font.display,
                fontSize: 20,
                color: ink.base,
              }}
            >
              You are signed in as <strong>{me.role}</strong>. Dispatch needs <strong>admin</strong>
              .
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/aether/me"
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    color: accent.deep,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Back to My atlas →
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {isAdmin && (
          <>
            {/* Aggregate metrics */}
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
                  { label: 'Active trips', value: String(activeTrips.length) },
                  { label: 'Drafts', value: String(drafts) },
                  { label: 'Archived', value: String(archivedTrips.length) },
                  {
                    label: 'Total ever',
                    value: String(activeTrips.length + archivedTrips.length),
                  },
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
                        fontSize: 'clamp(26px, 3vw, 36px)',
                        lineHeight: 1.1,
                        letterSpacing: '-0.018em',
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

            {/* Recent active */}
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
                  }}
                >
                  Recent · last 10 active
                </p>
                <h2
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(28px, 3vw, 40px)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.018em',
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 ${theme.space.gutter}px`,
                    color: ink.base,
                  }}
                >
                  In flight.
                </h2>
                {activeTrips.length === 0 ? (
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      color: ink.soft,
                      margin: 0,
                    }}
                  >
                    No active trips. (Or the gate is still loading.)
                  </p>
                ) : (
                  <ol
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: theme.space.tight,
                    }}
                  >
                    {activeTrips.slice(0, 10).map((t, idx) => (
                      <li key={t.id}>
                        <Link
                          href={`/aether/journey/${t.id}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '48px 1fr auto',
                            alignItems: 'baseline',
                            gap: theme.space.comfy,
                            padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                            borderRadius: theme.radius.md,
                            border: `1px solid ${olive.whisper}`,
                            textDecoration: 'none',
                            color: 'inherit',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: theme.font.mono,
                              fontSize: 11,
                              color: olive.deep,
                              letterSpacing: '0.14em',
                            }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div
                              style={{
                                fontFamily: theme.font.display,
                                fontSize: 20,
                                fontWeight: 600,
                                lineHeight: 1.2,
                                color: ink.base,
                              }}
                            >
                              {t.title}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                fontFamily: theme.font.ui,
                                fontSize: 11,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: ink.soft,
                              }}
                            >
                              {t.status} · {t.radiusKm}km · edited {fmtDate(t.updatedAt)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontFamily: theme.font.ui,
                              fontSize: theme.text.small.size,
                              fontWeight: 600,
                              color: accent.deep,
                            }}
                          >
                            Open →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Reveal>

            {/* Recent archived */}
            {archivedTrips.length > 0 && (
              <Reveal>
                <div style={{ marginTop: theme.space.hero }}>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: ochre.deep,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    Last archived
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(24px, 2.6vw, 32px)',
                      lineHeight: 1.15,
                      letterSpacing: '-0.014em',
                      fontWeight: 600,
                      margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
                      color: ink.base,
                    }}
                  >
                    Closed in the last sweep.
                  </h2>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    {archivedTrips.slice(0, 5).map((t) => (
                      <li
                        key={t.id}
                        style={{
                          padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                          borderRadius: theme.radius.md,
                          background: ochre.whisper,
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          color: ink.base,
                        }}
                      >
                        <Link
                          href={`/aether/journey/${t.id}`}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          <strong style={{ fontFamily: theme.font.display }}>{t.title}</strong>
                          <span style={{ color: ink.soft }}>
                            {' '}
                            · archived {fmtDate(t.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
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
