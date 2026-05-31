'use client';

/**
 * <MeHome> — the authed user's Aether landing.
 *
 * Three large editorial cards (Journeys / Shares / Account) backed
 * by a quick-stats strip ("3 drafts · 12 trips total · 4 shares").
 * The Pulse FAB is still mounted by the shell, so this surface is
 * navigational, not transactional.
 *
 * Auth-gated identical to /aether/account.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from '@app/aether-core';
import { clearRecentPrompts, readRecentPrompts } from '../pulse/recent-prompts';
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
// AE317 — recent-activity one-liner for the /me header card.
import { summariseRecentActivity } from '../me/recent-activity-summary';
// AE327 — derived stats moved to a pure helper so the predicate (and
// any future stat) lives in one tested place.
import { summariseTripStats } from '../me/trip-stats-summary';
// AE331 — shared CustomEvent dispatcher for the AE96 Pulse-open bridge.
import { openPulse } from '../pulse/open-pulse';

interface CardSpec {
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly cta: string;
}

const CARDS: ReadonlyArray<CardSpec> = [
  {
    kicker: '01 · the road',
    title: 'Journeys.',
    body: 'Every trip you have sketched — drafts in motion, plans saved, journeys archived. Open one to read its shape, or start a new sketch.',
    href: '/aether/me/journeys',
    cta: 'Open journeys →',
  },
  {
    kicker: '02 · the pass-on',
    title: 'Shares.',
    body: 'Every read-only link you have minted. Copy a link to pass on, revoke one to close it.',
    href: '/aether/me/shares',
    cta: 'Open shares →',
  },
  {
    kicker: '03 · the self',
    title: 'Account.',
    body: 'Who the road knows you as. Settings for audio, motion, privacy, and the way out.',
    href: '/aether/account',
    cta: 'Open account →',
  },
];

export function MeHome(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;

  const meQuery = useAuthControllerMe({ query: { enabled: isAuthed, retry: 1 } });
  const me = meQuery.data?.data as WhoAmIResponseDto | undefined;
  const activeQuery = useTripControllerList(
    { limit: '100', archived: 'false' },
    { query: { enabled: isAuthed } },
  );
  const archivedQuery = useTripControllerList(
    { limit: '100', archived: 'true' },
    { query: { enabled: isAuthed } },
  );

  const activeTrips = (activeQuery.data?.data as { trips?: TripDto[] } | undefined)?.trips ?? [];
  const archivedTrips =
    (archivedQuery.data?.data as { trips?: TripDto[] } | undefined)?.trips ?? [];
  // AE327 — derived stats via shared helper.
  const { drafts, totalTrips } = summariseTripStats({
    active: activeTrips,
    archived: archivedTrips,
  });

  // AE317 — surface the most-recent edit/draft/archive as a calm
  // one-liner. summariseRecentActivity sorts by timestamp + verb-
  // routes, so the UI just renders the .line. (Named `recentActivity`
  // to avoid colliding with the existing AE112 `recent` prompts list.)
  const recentActivity = summariseRecentActivity(
    [...activeTrips, ...archivedTrips].map((t) => ({
      title: t.title,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : null,
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : null,
      archivedAt: typeof t.archivedAt === 'string' ? t.archivedAt : null,
    })),
  );

  // AE112 — surface the AE106 long-memory `aether-pulse-recent:v1`
  // store. Read once on mount (client-only). One-tap dispatches the
  // AE96 `aether-pulse-open` event so the Pulse drawer takes over.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent(readRecentPrompts());
  }, []);
  function askAgain(prompt: string): void {
    openPulse(prompt);
  }
  // AE118 — confirm-then-clear so a misclick on a busy phone doesn't
  // nuke the long-memory list. Confirm chip stays for 4s, then resets.
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  function onClearClicked(): void {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    clearRecentPrompts();
    setRecent([]);
    setConfirmClear(false);
  }

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
            My atlas · {me?.role ?? 'traveller'}
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
            Your part of the road.
          </h1>
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
              Sign in to read your atlas.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/login?next=/aether/me"
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

        {/* AE317 — Recent activity one-liner (when there is any) */}
        {isAuthed && recentActivity !== null && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                padding: `${theme.space.comfy}px ${theme.space.gutter}px`,
                border: `1px solid ${ink.whisper}`,
                borderRadius: theme.radius.lg,
                background: surface.soft,
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: theme.space.comfy,
                flexWrap: 'wrap',
              }}
              role="status"
              aria-label="Most recent activity"
            >
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
                Recent
              </span>
              <span
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(18px, 2vw, 22px)',
                  fontStyle: 'italic',
                  color: ink.base,
                }}
              >
                {recentActivity.line}
              </span>
            </div>
          </Reveal>
        )}

        {/* Quick stats strip */}
        {isAuthed && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.loose,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                border: `1px solid ${ink.whisper}`,
                borderRadius: theme.radius.lg,
                background: surface.soft,
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Drafts', value: String(drafts) },
                { label: 'Trips total', value: String(totalTrips) },
                { label: 'Archived', value: String(archivedTrips.length) },
                { label: 'Role', value: me?.role ?? '—' },
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
                      fontSize: 'clamp(22px, 2.6vw, 32px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.014em',
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
        )}

        {/* Three big editorial cards */}
        {isAuthed && (
          <div
            style={{
              marginTop: theme.space.hero,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
              gap: theme.space.gutter,
            }}
          >
            {CARDS.map((c, idx) => (
              <Reveal key={c.title} delay={idx * 90}>
                <Link
                  href={c.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    minHeight: 280,
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: surface.soft,
                    border: `1px solid ${olive.whisper}`,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition:
                      'transform 280ms cubic-bezier(0.42, 0, 0.18, 1), border-color 280ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accent.deep;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = olive.whisper;
                    e.currentTarget.style.transform = 'translateY(0)';
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
                      {c.kicker}
                    </p>
                    <h2
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 'clamp(28px, 3vw, 40px)',
                        lineHeight: 1.1,
                        letterSpacing: '-0.018em',
                        fontWeight: 600,
                        margin: `${theme.space.tight}px 0 0`,
                        color: ink.base,
                      }}
                    >
                      {c.title}
                    </h2>
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 16,
                        lineHeight: 1.55,
                        color: ink.soft,
                        margin: `${theme.space.comfy}px 0 0`,
                      }}
                    >
                      {c.body}
                    </p>
                  </div>
                  <span
                    style={{
                      marginTop: theme.space.gutter,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.body.size,
                      fontWeight: 600,
                      color: accent.deep,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {c.cta}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        {/* AE112 — Recent prompts (Pulse long memory) */}
        {isAuthed && recent.length > 0 && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: surface.soft,
                border: `1px solid ${olive.whisper}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: theme.space.comfy,
                }}
              >
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
                  Recent prompts · {recent.length}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: theme.space.comfy,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontFamily: theme.font.mono,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      color: ink.soft,
                      opacity: 0.65,
                    }}
                  >
                    click to ask Pulse again
                  </span>
                  {/* AE118 — confirm-then-clear */}
                  <button
                    type="button"
                    onClick={onClearClicked}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: confirmClear ? accent.deep : ink.soft,
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      textDecoration: 'underline',
                      fontWeight: confirmClear ? 600 : 400,
                    }}
                    aria-label={
                      confirmClear ? 'Confirm clearing recent prompts' : 'Clear all recent prompts'
                    }
                  >
                    {confirmClear ? 'tap again to confirm' : 'clear all'}
                  </button>
                </div>
              </div>
              <h2
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(24px, 2.6vw, 32px)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.014em',
                  fontWeight: 600,
                  margin: `${theme.space.hairline}px 0 ${theme.space.tight}px`,
                  color: ink.base,
                }}
              >
                Questions worth asking again.
              </h2>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: theme.space.hairline,
                }}
              >
                {recent.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => askAgain(prompt)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: `1px solid ${ink.whisper}`,
                        borderRadius: theme.radius.md,
                        padding: `${theme.space.tight}px ${theme.space.inline}px`,
                        cursor: 'pointer',
                        fontFamily: theme.font.display,
                        fontSize: 15,
                        lineHeight: 1.45,
                        color: ink.base,
                        transition: 'border-color 220ms, background 220ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accent.deep;
                        e.currentTarget.style.background = ochre.whisper;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = ink.whisper;
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: accent.deep,
                          marginRight: 10,
                          fontFamily: theme.font.mono,
                          fontSize: 11,
                        }}
                      >
                        ↻
                      </span>
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Quick paths */}
        {isAuthed && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                display: 'flex',
                flexWrap: 'wrap',
                gap: theme.space.tight,
              }}
            >
              <Link
                href="/aether/plan"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${theme.space.tight}px ${theme.space.loose}px`,
                  borderRadius: theme.radius.pill,
                  background: ink.base,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.button.size,
                  fontWeight: theme.text.button.weight,
                  textDecoration: 'none',
                }}
              >
                Sketch a new yatra →
              </Link>
              <Link
                href="/aether/atlas"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${theme.space.tight}px ${theme.space.loose}px`,
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  border: `1px solid ${ink.whisper}`,
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                See the atlas
              </Link>
              <Link
                href="/aether/journal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${theme.space.tight}px ${theme.space.loose}px`,
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  border: `1px solid ${ink.whisper}`,
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Read the journal
              </Link>
            </div>
          </Reveal>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
