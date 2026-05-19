/**
 * Root layout for the App Router. Wraps every page with the basic
 * HTML scaffold + global metadata + the theme + auth providers.
 *
 * `themeBootScript` runs BEFORE React hydrates so the `dark` class
 * lands on `<html>` synchronously — no flash-of-wrong-theme. The
 * post-hydration <ThemeToggle> in the header keeps the store and the
 * DOM class in sync from there.
 *
 * Installed by [IV.18.19.14]; theme bootstrap added in [IV.18.19.28].
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import Link from 'next/link';
import './globals.css';
import { ActiveSosBanner } from '../components/safety/active-sos-banner';
import { SosFab } from '../components/safety/sos-fab';
import { TranslateWidget } from '../components/translation/translate-widget';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { UserMenu } from '../components/user-menu';
import { InboxBadge } from '../components/inbox/inbox-badge';
import { AxeDevBoot } from '../components/a11y/axe-dev-boot';
import { LiveRegion } from '../components/a11y/live-region';
import { SkipToMain } from '../components/a11y/skip-to-main';
import { CommandPalette } from '../components/cmdk/command-palette';
import { ShortcutSheet } from '../components/cmdk/shortcut-sheet';
import { Logo } from '../components/branding/logo';
import { Footer } from '../components/landing/footer';
import { AuraNudge } from '../components/auth/aura-nudge';
import { GlobalAssistant } from '../components/assistant/global-assistant';
import { Providers } from './providers';

// POST.2 — Inter as the brand typeface. `next/font/google` self-hosts
// the file at build time, so no FCP regression and no CLS risk. We
// expose the CSS variable globally and pipe it into --font-sans via
// globals.css so every Tailwind `font-sans` utility uses Inter.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Premium identity — Playfair Display is the luxury display serif
// (high-contrast, editorial, "royal"). Self-hosted by next/font at
// build time (no CLS / FCP cost). Exposed as --font-playfair and
// piped into --font-display via globals.css so any `font-display`
// utility renders the couture serif. UI text stays Inter.
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TravelSuperApp',
  description: 'Mobile-first, AI-powered travel super-app.',
};

const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem('travel-web-theme');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    // V.UX.15 — comfort mode boot. Mirror the theme dance so the
    // .comfort class lands on <html> BEFORE React hydrates (no
    // flash-of-wrong-density).
    var comfort = localStorage.getItem('travel-web-comfort');
    if (comfort === 'on') document.documentElement.classList.add('comfort');
  } catch (e) { /* localStorage unavailable — fall through to default light */ }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        {/* `beforeInteractive` injects this synchronously into the
            head BEFORE the page renders, eliminating theme flash. */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
      </head>
      <body className="bg-surface text-surface-foreground font-sans antialiased">
        {/* V.UX.28 — first-tab-stop skip link. Hidden until focused. */}
        <SkipToMain />
        <Providers>
          {/* V.UX.35 — sticky SOS banner. Renders nothing when no
              active SOS; surfaces "I'm OK" cancel + local 911 when active. */}
          <ActiveSosBanner />
          <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
            <header
              className="sticky top-3 z-40 -mx-3 flex items-center justify-between gap-3 rounded-2xl border border-gold-600/15 bg-surface/70 px-4 py-2.5 shadow-(--shadow-depth-2) backdrop-blur-xl supports-backdrop-filter:bg-surface/60"
              role="banner"
            >
              {/* Premium glass top-bar — gold hairline, sticky, blurred. */}
              <Logo />
              <nav aria-label="Primary" className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/home"
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Home
                </Link>
                <Link
                  href="/feed"
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Feed
                </Link>
                <Link
                  href="/navigate"
                  className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-block"
                >
                  Navigate
                </Link>
                <Link
                  href="/diary"
                  className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-block"
                >
                  Diary
                </Link>
                <InboxBadge />
                <ThemeToggle />
                <UserMenu />
              </nav>
            </header>
            <main id="main" tabIndex={-1} className="outline-none">
              <AuraNudge />
              {children}
            </main>
            <Footer />
          </div>
          {/* V.UX.13 — persistent SOS FAB. Renders disabled for
              anonymous callers; tap → confirm modal → POST /safety/sos
              → fan-out to trusted contacts. */}
          <SosFab />
          {/* Phase 2 (D2) — app-wide AI travel planner, stacked above
              the SOS FAB (bottom-right). $0 public planner chain. */}
          <GlobalAssistant />
          {/* V.UX.18 — persistent translate widget bottom-left.
              Disabled for anonymous callers (api requires auth). */}
          <TranslateWidget />
          {/* V.UX.28 — visually-hidden ARIA live regions. Consumers
              push messages via `announce()` from `lib/announce.ts`. */}
          <LiveRegion />
          {/* V.UX.28 — @axe-core/react in dev only. Logs a11y
              violations to the console as React renders. */}
          <AxeDevBoot />
          {/* V.UX.29 — global command palette (Cmd+K) + shortcut
              cheat-sheet (?). Both render their own portal/modal so
              they float above every other element. */}
          <CommandPalette />
          <ShortcutSheet />
        </Providers>
      </body>
    </html>
  );
}
