/**
 * Shared premium frame for the auth surfaces (/login, /register, and
 * the forgot/reset/mfa sub-pages). Royal gradient header band with a
 * gold eyebrow + Playfair title, then a gold-hairline card that holds
 * the form. Pure presentational — zero client state, no logic — so
 * each page keeps its own hooks/mutations untouched.
 *
 * Installed for the royal frontend pass (auth elevation).
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../branding/logo';
import { CinematicAuthBackground } from './cinematic-auth-background';

export interface AuthShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}

export function AuthShell({ eyebrow, title, subtitle, children }: AuthShellProps) {
  return (
    <main className="relative z-10 mx-auto max-w-md space-y-6">
      <CinematicAuthBackground />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-sm text-white/85 backdrop-blur-sm transition hover:text-gold-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-9 text-center shadow-(--shadow-depth-2)"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative flex justify-center">
          <Logo variant="mark" markSize="h-9 w-9" />
        </div>
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          {eyebrow}
        </p>
        <h1 className="relative mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="relative mx-auto mt-2 max-w-sm text-sm text-white/65">{subtitle}</p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-gold-600/15 bg-surface p-6 shadow-(--shadow-depth-1) sm:p-7">
        {children}
      </div>
    </main>
  );
}

/** Premium inline error pill — shared across the auth forms. */
export function AuthError({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}
