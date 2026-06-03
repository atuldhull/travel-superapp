/**
 * v2 footer — premium multi-column footer on the light ground. Links
 * route to real, existing pages. The `#about` anchor lands here.
 * Server component.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../branding/logo';

// Self-contained social glyphs — lucide dropped its brand icons, so we
// inline tiny SVGs to avoid a hard dependency on icon names.
function IgIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.9" cy="7.1" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FbIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.3 1.4-1.3h1.4V5.6c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2H8.2V14h2.4v7h2.9Z" />
    </svg>
  );
}
function XIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.2 3.5h2.9l-6.3 7.2 7.4 9.8h-5.8l-4.5-5.9-5.2 5.9H2.8l6.7-7.7L2.4 3.5h6l4.1 5.4 4.7-5.4Zm-1 14.7h1.6L7.9 5.2H6.2l10 13Z" />
    </svg>
  );
}
function YtIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22.4 12 31 31 0 0 0 22 8.2ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
    </svg>
  );
}

const COLUMNS = [
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '/help' },
      { label: 'Press', href: '/press' },
      { label: 'Sustainability', href: '/help' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Booking Terms', href: '/terms' },
      { label: 'Contact Us', href: '/help' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      { label: 'Destinations', href: '#destinations' },
      { label: 'Experiences', href: '#experiences' },
      { label: 'Packages', href: '#packages' },
      { label: 'AI Planner', href: '#plan' },
    ],
  },
] as const;

const SOCIALS = [
  { label: 'Instagram', Icon: IgIcon },
  { label: 'Facebook', Icon: FbIcon },
  { label: 'X', Icon: XIcon },
  { label: 'YouTube', Icon: YtIcon },
] as const;

export function V2Footer(): React.ReactElement {
  return (
    <footer id="about" className="border-t border-gold-600/15 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand + newsletter */}
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Luxury travel, redefined for the modern explorer. Curated journeys, planned by AI,
              watched over end to end.
            </p>
            <form className="mt-6 flex max-w-sm items-center gap-2 rounded-full border border-gold-600/20 bg-surface p-1.5 pl-4 shadow-(--shadow-depth-1)">
              <input
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
                className="w-full bg-transparent text-sm text-surface-foreground outline-none placeholder:text-muted"
              />
              <Link
                href={'/register' as never}
                aria-label="Subscribe"
                className="inline-flex shrink-0 items-center justify-center rounded-full px-3.5 py-2 text-brand-900 transition hover:-translate-y-0.5"
                style={{ backgroundImage: 'var(--gradient-gold)' }}
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </form>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-surface-foreground">{col.heading}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href as never}
                      className="text-sm text-muted transition hover:text-gold-600 dark:hover:text-gold-400"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gold-600/10 pt-6 sm:flex-row">
          <p className="text-xs text-muted">© 2026 TravelSuperApp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {SOCIALS.map(({ label, Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="text-muted transition hover:text-gold-600 dark:hover:text-gold-400"
              >
                <Icon />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-5 text-xs text-muted">
            <Link href={'/privacy' as never} className="transition hover:text-gold-600">
              Privacy
            </Link>
            <Link href={'/terms' as never} className="transition hover:text-gold-600">
              Terms
            </Link>
            <Link href={'/cookies' as never} className="transition hover:text-gold-600">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
