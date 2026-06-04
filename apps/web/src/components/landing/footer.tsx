/**
 * POST.6 — Site-wide footer. Replaces the inline footer that lived
 * in layout.tsx with a fuller surface that links to the new
 * marketing + legal pages.
 *
 * Pure server component — no client JS. Theme-aware via Tailwind
 * utilities. Listed by sitemap.ts so crawlers can discover all
 * the linked surfaces.
 */
import Link from 'next/link';
import type { Route } from 'next';

const SITE_GITHUB = 'https://github.com/atuldhull/travel-app';

interface FooterLink {
  readonly href: Route | (string & {});
  readonly label: string;
  readonly external?: boolean;
}

const COLUMNS: ReadonlyArray<{ readonly heading: string; readonly links: readonly FooterLink[] }> =
  [
    {
      heading: 'Product',
      links: [
        { href: '/pricing', label: 'Pricing' },
        { href: '/help', label: 'Help centre' },
        { href: '/status', label: 'Status' },
        { href: '/demo', label: 'Live demo' },
        { href: '/press', label: 'Press kit' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { href: '/terms', label: 'Terms of Service' },
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/cookies', label: 'Cookie Policy' },
        { href: '/accessibility', label: 'Accessibility statement' },
      ],
    },
    {
      heading: 'Connect',
      links: [
        { href: SITE_GITHUB, label: 'GitHub', external: true },
        { href: 'mailto:hello@travel.local', label: 'hello@travel.local', external: true },
        { href: 'mailto:security@travel.local', label: 'Security disclosure', external: true },
      ],
    },
  ];

export function Footer() {
  return (
    <footer role="contentinfo" className="mt-12 border-t border-gold-600/12 text-xs text-muted">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                {col.heading}
              </h2>
              <ul className="space-y-1.5">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        target={l.href.startsWith('http') ? '_blank' : undefined}
                        rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link
                        href={l.href as never}
                        className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-8 border-t border-gold-600/12 pt-4 text-[11px]">
          © {new Date().getFullYear()} TravelSuperApp. Built with care for travellers.
        </p>
      </div>
    </footer>
  );
}
