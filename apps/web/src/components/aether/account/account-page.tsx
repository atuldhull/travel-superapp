'use client';

/**
 * <AccountPage> — your atlas.
 *
 * Editorial settings surface. Sections:
 *   • Hero: "Your atlas" kicker + display title.
 *   • Identity: who the session knows you as (sub + role +
 *     previousSeenAt). The auth schema exposes only `sub` (no display
 *     name) so we render a short identifier.
 *   • Audio: describes the AudioChip's behaviour + a link to it.
 *   • Motion: shows the current motion policy + the prefers-reduced-
 *     motion source.
 *   • Privacy: deep-link to the existing /account/privacy flow.
 *   • Sign out: posts /auth/logout + clears in-memory token.
 *
 * Auth-gated. Signed-out renders the same calm "sign in" wall.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMotionPolicy, useTheme } from '@app/aether-core';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { clearAccessToken } from '../../../lib/auth-store';
import { useViewport } from '../use-viewport';

function fmtDate(v: unknown): string | null {
  const iso = typeof v === 'string' ? v : null;
  if (iso === null) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortId(sub: string): string {
  if (sub.length <= 8) return sub;
  return `${sub.slice(0, 4)}…${sub.slice(-4)}`;
}

export function AccountPage(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [pulseCleared, setPulseCleared] = useState<boolean>(false);
  const [dataExported, setDataExported] = useState<boolean>(false);

  /** AE93 — wipes Pulse's persisted conversation (AE72). */
  function clearPulseHistory(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('aether-pulse-history:v1');
      setPulseCleared(true);
      window.setTimeout(() => setPulseCleared(false), 2000);
    } catch {
      /* quota / private mode — silently ignore */
    }
  }

  /** AE131 — bundle every locally-persisted Aether key into a single
   *  JSON blob and trigger a download. The reader of the file gets:
   *    - recentPrompts (AE106)
   *    - pulseHistory  (AE72)
   *    - checklists    (AE94, keyed by tripId)
   *    - onboarded     (AE46)
   *    - audioOptOut   (AE32/AE39)
   *  No identity / token fields are included — those live in memory
   *  + httpOnly cookies and are never localStorage-readable. */
  function downloadMyData(): void {
    if (typeof window === 'undefined') return;
    try {
      const safeRead = (key: string): unknown => {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      };
      const checklists: Record<string, unknown> = {};
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k !== null && k.startsWith('aether-checklist:') && k.endsWith(':v1')) {
          checklists[k] = safeRead(k);
        }
      }
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: 'aether-account',
        recentPrompts: safeRead('aether-pulse-recent:v1'),
        pulseHistory: safeRead('aether-pulse-history:v1'),
        checklists,
        onboarded: safeRead('aether-onboarded') !== null,
        audioOptOut: window.localStorage.getItem('aether-audio-opt-out') === '1',
      };
      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether-my-data-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setDataExported(true);
      window.setTimeout(() => setDataExported(false), 2000);
    } catch {
      /* quota / private mode — silently ignore */
    }
  }

  const meQuery = useAuthControllerMe({
    query: { enabled: isAuthed, retry: 1 },
  });
  const me = meQuery.data?.data as WhoAmIResponseDto | undefined;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const onSignOut = async (): Promise<void> => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // best-effort; refresh cookie is httpOnly + server-revoked
    }
    clearAccessToken();
    queryClient.clear();
    router.replace('/login');
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
            Your atlas · आपका विवरण
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
            How the road knows you.
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
                  href="/login?next=/aether/account"
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

        {/* Identity */}
        {isAuthed && (
          <>
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${ink.whisper}`,
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
                  Identity
                </p>
                <h2
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(24px, 2.6vw, 34px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.014em',
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 0`,
                    color: ink.base,
                  }}
                >
                  {me !== undefined
                    ? `Traveller · ${me.role}`
                    : meQuery.isPending
                      ? 'Reading your card…'
                      : 'Could not read your card.'}
                </h2>
                {me !== undefined && (
                  <dl
                    style={{
                      marginTop: theme.space.comfy,
                      display: 'grid',
                      gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
                      gap: theme.space.comfy,
                    }}
                  >
                    <div>
                      <dt
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: ink.soft,
                          fontWeight: 600,
                        }}
                      >
                        Account ID
                      </dt>
                      <dd
                        style={{
                          margin: '6px 0 0',
                          fontFamily: theme.font.mono,
                          fontSize: 14,
                          color: ink.base,
                        }}
                      >
                        {shortId(me.sub)}
                      </dd>
                    </div>
                    <div>
                      <dt
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: ink.soft,
                          fontWeight: 600,
                        }}
                      >
                        Onboarded
                      </dt>
                      <dd
                        style={{
                          margin: '6px 0 0',
                          fontFamily: theme.font.display,
                          fontSize: 17,
                          color: ink.base,
                          fontWeight: 600,
                        }}
                      >
                        {me.hasSeenOnboarding ? 'Yes' : 'Not yet'}
                      </dd>
                    </div>
                    <div>
                      <dt
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: ink.soft,
                          fontWeight: 600,
                        }}
                      >
                        Last seen
                      </dt>
                      <dd
                        style={{
                          margin: '6px 0 0',
                          fontFamily: theme.font.display,
                          fontSize: 17,
                          color: ink.base,
                          fontWeight: 600,
                        }}
                      >
                        {fmtDate(me.previousSeenAt) ?? '—'}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </Reveal>

            {/* Audio settings */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${olive.whisper}`,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: olive.deep,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Audio
                </p>
                <h2
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
                  Mandatory ambient · respects mute.
                </h2>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: ink.soft,
                    margin: `${theme.space.tight}px 0 0`,
                  }}
                >
                  Aether plays a soft bell every now and then. The volume slider lives on the top
                  nav (the small dot beside the Open-the-app pill). Mute is honoured app-wide and
                  saved to this browser. We never block the page on audio failing — silence is
                  always a valid state.
                </p>
              </div>
            </Reveal>

            {/* Motion */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${olive.whisper}`,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: olive.deep,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Motion · current policy · {motionPolicy}
                </p>
                <h2
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
                  Reads your system preference.
                </h2>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: ink.soft,
                    margin: `${theme.space.tight}px 0 0`,
                  }}
                >
                  {motionPolicy === 'full'
                    ? 'Full motion: parallax, ken-burns, reveals, hero cross-fades.'
                    : motionPolicy === 'essential'
                      ? 'Essential motion: layout transitions only, no parallax or auto-rotation.'
                      : 'No motion: everything renders statically.'}{' '}
                  To change it, flip prefers-reduced-motion in your OS settings. Aether listens and
                  updates without a refresh.
                </p>
              </div>
            </Reveal>

            {/* Privacy */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${ochre.deep}`,
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
                  Privacy + data
                </p>
                <h2
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
                  Export, delete, opt out.
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
                  Aether shares the same privacy posture as the main app: export anything, delete
                  anything, refuse anything.
                </p>
                <Link
                  href="/account/privacy"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${ochre.deep}`,
                    color: ochre.deep,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    textDecoration: 'none',
                  }}
                >
                  Open the privacy panel
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </Reveal>

            {/* AE93 — Pulse history (persisted conversation, AE72) */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${olive.whisper}`,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: olive.deep,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Pulse history
                </p>
                <h2
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
                  Persisted conversation.
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
                  Pulse remembers the last conversation in this browser so you can refine a sketched
                  plan across reloads. Wipe it if you want to start clean — Pulse on this device
                  will be a blank drawer again.
                </p>
                <button
                  type="button"
                  onClick={clearPulseHistory}
                  style={{
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${olive.deep}`,
                    color: olive.deep,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    cursor: 'pointer',
                  }}
                  aria-label="Clear Pulse conversation history"
                >
                  {pulseCleared ? '✓ Cleared' : 'Clear Pulse history'}
                </button>
              </div>
            </Reveal>

            {/* AE131 — download every Aether-stored local fact in one JSON */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  border: `1px solid ${olive.whisper}`,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: olive.deep,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Your data
                </p>
                <h2
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
                  Take a copy with you.
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
                  Recent prompts, the Pulse conversation, every per-trip checklist, the audio
                  preference, and whether you have seen the welcome. No tokens, no identity — those
                  never touch local storage.
                </p>
                <button
                  type="button"
                  onClick={downloadMyData}
                  style={{
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${ochre.deep}`,
                    color: ochre.deep,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    cursor: 'pointer',
                  }}
                  aria-label="Download every locally-stored Aether fact as a JSON file"
                >
                  {dataExported ? '✓ Downloaded' : 'Download my data (.json)'}
                </button>
              </div>
            </Reveal>

            {/* Sign out */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: 'rgba(184, 58, 46, 0.05)',
                  border: `1px solid rgba(184, 58, 46, 0.3)`,
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
                      color: '#8a2418',
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    Session
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(22px, 2.4vw, 28px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.014em',
                      fontWeight: 600,
                      margin: `${theme.space.hairline}px 0 0`,
                      color: ink.base,
                    }}
                  >
                    Sign out of this browser.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  disabled={signingOut}
                  style={{
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: '#8a2418',
                    color: surface.base,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    border: 'none',
                    cursor: signingOut ? 'wait' : 'pointer',
                    opacity: signingOut ? 0.7 : 1,
                  }}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </Reveal>
          </>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
