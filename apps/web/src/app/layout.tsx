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
import Script from 'next/script';
import './globals.css';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { WhoAmIBadge } from '../components/whoami-badge';
import { Providers } from './providers';

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
  } catch (e) { /* localStorage unavailable — fall through to default light */ }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* `beforeInteractive` injects this synchronously into the
            head BEFORE the page renders, eliminating theme flash. */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
      </head>
      <body className="bg-surface text-surface-foreground font-sans antialiased">
        <Providers>
          <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
            <header className="flex items-center justify-between gap-3">
              <WhoAmIBadge />
              <ThemeToggle />
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
