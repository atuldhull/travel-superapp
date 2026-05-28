'use client';

/**
 * Drift's own minimal top nav.
 *
 * The app's global navbar is suppressed on /aether/* (see AppChrome).
 * Drift owns its layout end-to-end, so it needs its own way to leave —
 * but the nav also has to read as part of the editorial composition,
 * not the generic app shell.
 *
 * Behaviour:
 *   • At top of page (scrollY < 24px): fully transparent. The hero
 *     photograph shows through; the wordmark sits in cream over the
 *     dark scrim. No background, no border.
 *   • Scrolled past 24px: glass-cream surface (rgba cream + blur),
 *     subtle ink border-bottom, springs into place via the `book`
 *     spring's feel. Provides the editorial header-on-scroll feel
 *     that publications like NYT Cooking + The New Yorker use.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { useViewport } from './use-viewport';
import { AudioChip } from './audio-chip';

export function DriftNav(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const [scrolled, setScrolled] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Token-derived inline styles, no raw hex.
  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;

  return (
    <header
      role="banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme.layer.sticky,
        background: scrolled ? 'rgba(242, 232, 213, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
        borderBottom: scrolled ? `1px solid ${ink.whisper}` : '1px solid transparent',
        transition: 'background 280ms cubic-bezier(0.42, 0, 0.18, 1), border-color 280ms',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.tight}px ${theme.space.comfy}px`
            : `${theme.space.inline}px ${theme.space.gutter}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.tight,
        }}
      >
        {/* Wordmark + mark */}
        <Link
          href="/aether/drift"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.space.tight,
            textDecoration: 'none',
            color: scrolled ? ink.base : surface.base,
            transition: 'color 280ms cubic-bezier(0.42, 0, 0.18, 1)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: theme.radius.pill,
              background: accent.base,
              color: surface.base,
              fontFamily: theme.font.display,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.04em',
            }}
          >
            ॐ
          </span>
          <span
            style={{
              fontFamily: theme.font.display,
              fontSize: isNarrow ? theme.text.body.size : theme.text.large.size,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {isNarrow ? 'Aether' : 'TravelSuperApp'}
          </span>
          {!isNarrow && (
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                opacity: 0.6,
                marginLeft: theme.space.tight,
              }}
            >
              · Aether
            </span>
          )}
        </Link>

        {/* Right side: anchor links + "back to app". On narrow only
            the Open-the-app pill survives — Pulse + the nav anchors
            here would overflow at <640px. The other sections are still
            reachable via the EditorialFooter sitemap + Pulse FAB. */}
        <nav
          aria-label="Drift sections"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isNarrow ? theme.space.tight : theme.space.inline,
          }}
        >
          {!isNarrow && (
            <>
              <a
                href="#esperienze"
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? ink.soft : surface.soft,
                  transition: 'color 280ms',
                }}
              >
                Experiences
              </a>
              <Link
                href="/aether/atlas"
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? ink.soft : surface.soft,
                  transition: 'color 280ms',
                }}
              >
                Atlas
              </Link>
              <Link
                href="/aether/journal"
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? ink.soft : surface.soft,
                  transition: 'color 280ms',
                }}
              >
                Journal
              </Link>
              <Link
                href="/aether/me/journeys"
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? ink.soft : surface.soft,
                  transition: 'color 280ms',
                }}
              >
                My journeys
              </Link>
              <Link
                href="/aether/about"
                style={{
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? ink.soft : surface.soft,
                  transition: 'color 280ms',
                }}
              >
                About
              </Link>
            </>
          )}
          {!isNarrow && <AudioChip inverted={!scrolled} />}
          <Link
            href="/home"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: `${theme.space.hairline}px ${theme.space.inline}px`,
              borderRadius: theme.radius.pill,
              background: scrolled ? ink.base : 'rgba(242, 232, 213, 0.15)',
              color: scrolled ? surface.base : surface.base,
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              fontWeight: 600,
              letterSpacing: '0.01em',
              textDecoration: 'none',
              border: scrolled ? 'none' : `1px solid ${surface.whisper}`,
              transition: 'background 280ms, border-color 280ms',
            }}
          >
            {isNarrow ? 'App' : 'Open the app'}
            <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
