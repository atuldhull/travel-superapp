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
  const drafts = activeTrips.filter((t) => t.status === 'draft').length;
  const totalTrips = activeTrips.length + archivedTrips.length;

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

        {/* Quick stats strip */}
        {isAuthed && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
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
