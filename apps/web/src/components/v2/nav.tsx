/**
 * v2 top nav — over the dark hero (white text, no background). Auth
 * aware (Sign In ↔ Dashboard). Marketing links smooth-scroll to the
 * sections; on mobile they collapse into a hamburger drawer.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '../branding/logo';
import { useAuthToken } from '../../lib/use-auth-token';
import { GOLD_TEXT } from './kit';

const LINKS = [
  { href: '#destinations', label: 'Destinations' },
  { href: '#experiences', label: 'Experiences' },
  { href: '#packages', label: 'Journeys' },
  { href: '#plan', label: 'AI Planner' },
  { href: '#about', label: 'About' },
] as const;

export function V2Nav(): React.ReactElement {
  const token = useAuthToken();
  const signedIn = token !== null;
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
        <Link
          href={'/v2' as never}
          aria-label="TravelSuperApp — home"
          className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
        >
          <Logo variant="mark" asLink={false} markSize="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
            Travel
            <span style={GOLD_TEXT}>Super</span>
            App
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {signedIn ? (
            <Link
              href={'/home' as never}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-900 transition hover:-translate-y-0.5 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href={'/login' as never}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex rounded-full border border-white/20 p-2 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 lg:hidden"
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
        <nav
          aria-label="Mobile"
          className="mx-4 rounded-2xl border border-white/15 bg-brand-900/95 p-2 shadow-(--shadow-depth-3) backdrop-blur-xl lg:hidden"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
