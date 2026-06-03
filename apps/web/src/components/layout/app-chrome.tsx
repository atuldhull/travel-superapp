'use client';

/**
 * AppChrome — conditional outer chrome for the entire app.
 *
 * The root layout wraps every route in a centered max-w-3xl container +
 * a dark glass nav + the footer. That's correct for the existing
 * TravelSuperApp pages, but on Aether surfaces (/aether/*) it boxes the
 * editorial design into a 768px column and overlays a chrome that
 * fights the Warm palette.
 *
 * This component reads the pathname and chooses between two layouts:
 *   • Aether routes  → bare `{children}`, no wrapper, no chrome.
 *     Drift / Atlas / Lumen own their own headers + footers.
 *   • Everything else → the existing wrapper-nav-main-footer chrome.
 *
 * Lives outside `<Providers>` only because pathname comes from
 * next/navigation which works inside any client tree.
 */
import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface AppChromeProps {
  nav: ReactNode;
  footer: ReactNode;
  nudge: ReactNode;
  children: ReactNode;
}

/** Pathname prefixes that render bare (no app chrome). */
// `/v2` is the premium "Fusion" landing — it ships its own full-bleed
// nav + footer end-to-end, so it opts out of the max-w-3xl chrome too.
const BARE_PREFIXES = ['/aether/', '/v2'] as const;

function isBare(pathname: string | null | undefined): boolean {
  if (pathname === null || pathname === undefined) return false;
  return BARE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function AppChrome({ nav, footer, nudge, children }: AppChromeProps): React.ReactElement {
  const pathname = usePathname();
  if (isBare(pathname)) {
    // Aether surfaces own their layout end-to-end. Just hand them the page.
    return (
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      {nav}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 outline-none"
      >
        {nudge}
        {children}
      </main>
      {footer}
    </div>
  );
}

/** Same-rule companion that hides global FABs (SOS / Assistant / Translate)
 *  on bare routes. Wraps any node and returns null on Aether routes. */
export function HideOnAether({ children }: { children: ReactNode }): React.ReactElement | null {
  const pathname = usePathname();
  if (isBare(pathname)) return null;
  return <>{children}</>;
}
