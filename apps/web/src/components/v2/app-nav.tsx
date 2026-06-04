/**
 * AppNav — the unified, premium top navigation for the WHOLE logged-in
 * app (every non-landing, non-aether route). Replaces the old narrow
 * glass pill. Full-bleed sticky glass bar in the v2 design language,
 * with the real UserMenu / InboxBadge / ThemeToggle preserved so all
 * existing auth + notification behaviour keeps working. Collapses to a
 * hamburger drawer on mobile.
 *
 * A "More" dropdown surfaces the secondary tool surfaces (Near me,
 * Navigate, Transport, Weather, Featured, Report a scam, Help) so no
 * feature is reachable by direct URL only.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, Sparkles, X } from 'lucide-react';
import { Logo } from '../branding/logo';
import { ThemeToggle } from '../ui/theme-toggle';
import { UserMenu } from '../user-menu';
import { InboxBadge } from '../inbox/inbox-badge';
import { cn } from '../../lib/cn';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/trips', label: 'Trips' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/discover', label: 'Discover' },
  { href: '/stays', label: 'Stays' },
  { href: '/events', label: 'Events' },
  { href: '/feed', label: 'Feed' },
] as const;

// Secondary tool surfaces — reachable from every page via the "More"
// menu so no feature is URL-only. (Connectivity has no index route and
// Safety's entry point is the scam-report form, so we link those
// concrete destinations.)
const MORE_LINKS = [
  { href: '/journal', label: 'Stories' },
  { href: '/diary', label: 'Diary' },
  { href: '/near-me', label: 'Near me' },
  { href: '/navigate', label: 'Navigate' },
  { href: '/transport', label: 'Transport fit' },
  { href: '/weather', label: 'Weather' },
  { href: '/featured', label: 'Featured books' },
  { href: '/safety/scam-report', label: 'Report a scam' },
  { href: '/help', label: 'Help & SOS' },
] as const;

export function AppNav(): React.ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string): boolean =>
    pathname === href || (pathname ?? '').startsWith(`${href}/`);
  const moreActive = MORE_LINKS.some((l) => isActive(l.href));

  // Close both menus on navigation.
  useEffect(() => {
    setMoreOpen(false);
    setOpen(false);
  }, [pathname]);

  // Dismiss the "More" dropdown on outside click / Esc.
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-gold-600/15 bg-surface/80 backdrop-blur-xl"
      role="banner"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href as never}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive(l.href)
                  ? 'bg-gold-500/12 text-gold-700 dark:text-gold-300'
                  : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}

          {/* More — secondary tool surfaces, reachable from every page. */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                moreActive || moreOpen
                  ? 'bg-gold-500/12 text-gold-700 dark:text-gold-300'
                  : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
              )}
            >
              More
              <ChevronDown
                aria-hidden
                className={cn('h-3.5 w-3.5 transition', moreOpen && 'rotate-180')}
              />
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-gold-600/15 bg-surface p-1.5 shadow-(--shadow-depth-3)"
              >
                {MORE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href as never}
                    role="menuitem"
                    aria-current={isActive(l.href) ? 'page' : undefined}
                    className={cn(
                      'block rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      isActive(l.href)
                        ? 'bg-gold-500/12 text-gold-700 dark:text-gold-300'
                        : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href={'/trips/new' as never}
            className="hidden items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
            style={{ backgroundImage: 'var(--gradient-gold)' }}
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Plan
          </Link>
          <InboxBadge />
          <ThemeToggle />
          <UserMenu />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex rounded-full border border-gold-600/20 p-2 text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="border-t border-gold-600/10 px-3 py-2 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href as never}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isActive(l.href)
                    ? 'bg-gold-500/12 text-gold-700 dark:text-gold-300'
                    : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-1.5 border-t border-gold-600/10 pt-1.5">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              More
            </p>
            <div className="grid grid-cols-2 gap-1">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href as never}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isActive(l.href)
                      ? 'bg-gold-500/12 text-gold-700 dark:text-gold-300'
                      : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
