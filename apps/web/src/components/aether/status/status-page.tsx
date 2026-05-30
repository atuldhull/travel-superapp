'use client';

/**
 * <StatusPage> — Aether health surface (AE75).
 *
 * Four sections:
 *   • Feature flag — confirms `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW=1`
 *     (the page only renders when set, so this always reads true; the
 *     point is to show the operator the value publicly).
 *   • API health — fires `GET /api/v1/health/ready` every 30s, shows
 *     {status, latency, lastChecked} with a green dot when ok.
 *   • Routes — counts: 15 destinations · 6 journal articles · 18
 *     surface routes (the static set, derived from a constant).
 *   • Build — commit sha + build time if NEXT_PUBLIC_BUILD_SHA /
 *     NEXT_PUBLIC_BUILD_TIME are exposed at deploy; otherwise '—'.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useViewport } from '../use-viewport';
import { ALL_SLUGS } from '../destinations/data';
import { ALL_JOURNAL_SLUGS } from '../journal/data';

/** Surface routes — kept in sync as new Aether pages land. The number
 *  is shown on the status card; keep updating as you add routes. */
const AETHER_SURFACE_ROUTES = [
  '/aether/drift',
  '/aether/atlas',
  '/aether/about',
  '/aether/plan',
  '/aether/destinations',
  '/aether/destinations/[slug]',
  '/aether/destinations/compare',
  '/aether/journal',
  '/aether/journal/[slug]',
  '/aether/journal/feed.xml',
  '/aether/journal/feed.atom',
  '/aether/journey/[id]',
  '/aether/me',
  '/aether/me/journeys',
  '/aether/me/shares',
  '/aether/account',
  '/aether/onboarding',
  '/aether/shared/[code]',
  '/aether/dispatch',
  '/aether/brand',
  '/aether/status',
  '/aether/sitemap.xml',
];

type Health = 'idle' | 'pinging' | 'ok' | 'error';

interface HealthSnap {
  state: Health;
  latencyMs: number | null;
  lastAt: number | null;
  error: string | null;
}

export function StatusPage(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const [health, setHealth] = useState<HealthSnap>({
    state: 'idle',
    latencyMs: null,
    lastAt: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const ping = async (): Promise<void> => {
      if (cancelled) return;
      setHealth((h) => ({ ...h, state: 'pinging' }));
      const t0 = performance.now();
      try {
        const res = await fetch('/api/v1/health/ready', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        const dt = Math.round(performance.now() - t0);
        if (cancelled) return;
        if (res.ok) {
          setHealth({ state: 'ok', latencyMs: dt, lastAt: Date.now(), error: null });
        } else {
          setHealth({
            state: 'error',
            latencyMs: dt,
            lastAt: Date.now(),
            error: `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setHealth({
          state: 'error',
          latencyMs: null,
          lastAt: Date.now(),
          error: err instanceof Error ? err.message : 'fetch failed',
        });
      }
    };
    void ping();
    const id = window.setInterval(() => void ping(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const flagOn = process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] === '1';
  const sha = process.env['NEXT_PUBLIC_BUILD_SHA'] ?? null;
  const buildTime = process.env['NEXT_PUBLIC_BUILD_TIME'] ?? null;

  const healthDot =
    health.state === 'ok' ? olive.base : health.state === 'error' ? '#c2614a' : ink.soft;

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
          maxWidth: 960,
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
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Status · operator
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 76px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: `${theme.space.tight}px 0 0`,
              color: ink.base,
            }}
          >
            Is the road open?
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 22px)',
              lineHeight: 1.55,
              color: ink.soft,
              margin: `${theme.space.loose}px 0 0`,
              maxWidth: '52ch',
            }}
          >
            A small honest dashboard. Feature flag, api ping, route counts, build sha. Refreshes the
            api every 30s.
          </p>
        </Reveal>

        {/* Flag */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.hero,
              padding: theme.space.loose,
              borderRadius: theme.radius.lg,
              background: surface.soft,
              border: `1px solid ${ink.whisper}`,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '160px 1fr',
              gap: theme.space.comfy,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ink.soft,
                fontWeight: 600,
              }}
            >
              Feature flag
            </span>
            <div>
              <code
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 13,
                  color: ink.base,
                }}
              >
                NEXT_PUBLIC_FEATURE_AETHER_PREVIEW = {flagOn ? '1' : 'unset'}
              </code>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 15,
                  color: ink.soft,
                  margin: `${theme.space.tight}px 0 0`,
                }}
              >
                {flagOn
                  ? 'The preview surface is live; every Aether route mounts.'
                  : 'Set to 1 to expose the preview.'}
              </p>
            </div>
          </div>
        </Reveal>

        {/* API health */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.gutter,
              padding: theme.space.loose,
              borderRadius: theme.radius.lg,
              background: surface.soft,
              border: `1px solid ${health.state === 'error' ? '#c2614a' : ink.whisper}`,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '160px 1fr',
              gap: theme.space.comfy,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ink.soft,
                fontWeight: 600,
              }}
            >
              API health
            </span>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: theme.font.display,
                  fontSize: 22,
                  fontWeight: 600,
                  color: ink.base,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: healthDot,
                    boxShadow: `0 0 8px ${healthDot}`,
                  }}
                />
                {health.state === 'ok'
                  ? 'ready'
                  : health.state === 'pinging'
                    ? 'pinging…'
                    : health.state === 'error'
                      ? 'down'
                      : 'idle'}
                {health.latencyMs !== null && (
                  <span
                    style={{
                      fontFamily: theme.font.mono,
                      fontSize: 12,
                      color: ink.soft,
                      opacity: 0.78,
                    }}
                  >
                    {health.latencyMs}ms
                  </span>
                )}
              </span>
              <p
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  color: ink.soft,
                  letterSpacing: '0.06em',
                  margin: `${theme.space.tight}px 0 0`,
                }}
              >
                {health.lastAt !== null
                  ? `checked ${new Date(health.lastAt).toLocaleTimeString()}`
                  : 'not yet checked'}
                {health.error !== null && ` · ${health.error}`}
              </p>
            </div>
          </div>
        </Reveal>

        {/* Routes */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.gutter,
              padding: theme.space.loose,
              borderRadius: theme.radius.lg,
              background: surface.soft,
              border: `1px solid ${ink.whisper}`,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '160px 1fr',
              gap: theme.space.comfy,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ink.soft,
                fontWeight: 600,
              }}
            >
              Routes + data
            </span>
            <div>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                  color: ink.base,
                }}
              >
                {AETHER_SURFACE_ROUTES.length} surface routes ·{' '}
                <span style={{ color: accent.deep }}>{ALL_SLUGS.length}</span> destinations ·{' '}
                <span style={{ color: ochre.deep }}>{ALL_JOURNAL_SLUGS.length}</span> journal
                articles
              </p>
              <details style={{ marginTop: theme.space.comfy }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    color: accent.deep,
                    fontWeight: 600,
                  }}
                >
                  Show every surface route
                </summary>
                <ul
                  style={{
                    marginTop: theme.space.tight,
                    listStyle: 'none',
                    padding: 0,
                    display: 'grid',
                    gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                    gap: 4,
                    fontFamily: theme.font.mono,
                    fontSize: 12,
                  }}
                >
                  {AETHER_SURFACE_ROUTES.map((r) => (
                    <li key={r}>
                      <Link
                        href={r
                          .replace('[slug]', 'jaipur')
                          .replace('[id]', '')
                          .replace('[code]', '')}
                        style={{ color: ink.base, textDecoration: 'none' }}
                      >
                        {r}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </Reveal>

        {/* Build */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.gutter,
              padding: theme.space.loose,
              borderRadius: theme.radius.lg,
              background: surface.soft,
              border: `1px solid ${ink.whisper}`,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '160px 1fr',
              gap: theme.space.comfy,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ink.soft,
                fontWeight: 600,
              }}
            >
              Build
            </span>
            <div>
              <p
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 13,
                  color: ink.base,
                  margin: 0,
                }}
              >
                sha · {sha ?? '— (set NEXT_PUBLIC_BUILD_SHA at deploy)'}
              </p>
              <p
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 13,
                  color: ink.base,
                  margin: `${theme.space.hairline}px 0 0`,
                }}
              >
                built · {buildTime ?? '— (set NEXT_PUBLIC_BUILD_TIME at deploy)'}
              </p>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: ink.soft,
                  margin: `${theme.space.tight}px 0 0`,
                  maxWidth: '46ch',
                }}
              >
                Set the two env vars during the CI build (e.g.{' '}
                <code>
                  NEXT_PUBLIC_BUILD_SHA=${'{'}$GITHUB_SHA{'}'}
                </code>
                ) to surface them here.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <EditorialFooter />
    </div>
  );
}
