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
import './globals.css';
import { ActiveSosBanner } from '../components/safety/active-sos-banner';
import { SosFab } from '../components/safety/sos-fab';
import { TranslateWidget } from '../components/translation/translate-widget';
import { AxeDevBoot } from '../components/a11y/axe-dev-boot';
import { LiveRegion } from '../components/a11y/live-region';
import { SkipToMain } from '../components/a11y/skip-to-main';
import { CommandPalette } from '../components/cmdk/command-palette';
import { ShortcutSheet } from '../components/cmdk/shortcut-sheet';
import { Footer } from '../components/landing/footer';
import { AuraNudge } from '../components/auth/aura-nudge';
import { GlobalAssistant } from '../components/assistant/global-assistant';
import { PwaRegister } from '../components/pwa/pwa-register';
import { Providers } from './providers';
import { AppChrome, HideOnAether } from '../components/layout/app-chrome';
import { AppNav } from '../components/v2/app-nav';

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
  // I1 (Phase 6) — PWA metadata. The manifest lives at /public; the
  // App Router serves it verbatim. apple-* hints give iOS Safari the
  // standalone-launch affordances without a separate plist.
  manifest: '/manifest.webmanifest',
  applicationName: 'TravelSuperApp',
  appleWebApp: {
    capable: true,
    title: 'Travel',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

// Next 15 wants theme-color + viewport in their own export. We pair
// the light + dark theme colors with prefers-color-scheme so the
// browser chrome (Android URL bar, iOS status bar) matches the
// active surface — ivory on light, near-black on dark.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d12' },
  ],
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
          {/* AppChrome conditionally renders nav + container + footer for
              regular routes, OR bare children for /aether/* surfaces that
              own their own editorial layout end-to-end. */}
          <AppChrome nudge={<AuraNudge />} footer={<Footer />} nav={<AppNav />}>
            {children}
          </AppChrome>
          {/* V.UX.13 — persistent SOS FAB. Renders disabled for
              anonymous callers; tap → confirm modal → POST /safety/sos
              → fan-out to trusted contacts. Hidden on /aether/* so the
              editorial composition stays clean. */}
          <HideOnAether>
            <SosFab />
          </HideOnAether>
          {/* Phase 2 (D2) — app-wide AI travel planner, stacked above
              the SOS FAB (bottom-right). $0 public planner chain. */}
          <HideOnAether>
            <GlobalAssistant />
          </HideOnAether>
          {/* V.UX.18 — persistent translate widget bottom-left.
              Disabled for anonymous callers (api requires auth). */}
          <HideOnAether>
            <TranslateWidget />
          </HideOnAether>
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
          {/* Phase 6 / I1 — register the service worker for all
              visitors so the offline fallback page is pre-cached.
              Renders nothing; runs once on mount via useEffect. */}
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
