/**
 * AppNav — the unified, premium top navigation for the WHOLE logged-in
 * app (every non-landing, non-aether route). Replaces the old narrow
 * glass pill. Full-bleed sticky glass bar in the v2 design language,
 * with the real UserMenu / InboxBadge / ThemeToggle preserved so all
 * existing auth + notification behaviour keeps working. Collapses to a
 * hamburger drawer on mobile.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Sparkles, X } from 'lucide-react';
import { Logo } from '../branding/logo';
import { ThemeToggle } from '../ui/theme-toggle';
import { UserMenu } from '../user-menu';
import { InboxBadge } from '../inbox/inbox-badge';
import { cn } from '../../lib/cn';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/trips', label: 'Trips' },
  { href: '/discover', label: 'Discover' },
  { href: '/stays', label: 'Stays' },
  { href: '/events', label: 'Events' },
  { href: '/feed', label: 'Feed' },
  { href: '/diary', label: 'Diary' },
] as const;

export function AppNav(): React.ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string): boolean =>
    pathname === href || (pathname ?? '').startsWith(`${href}/`);

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
        </nav>
      ) : null}
    </header>
  );
}
