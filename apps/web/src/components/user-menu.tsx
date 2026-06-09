/**
 * Premium account menu — the missing logout lives here.
 *
 * Signed out → a quiet "Sign in" link. Signed in → a gold-ringed
 * avatar that opens a glass dropdown (framer-motion) with the
 * identity, the key destinations, and a real **Sign out** that:
 *   1. POST /api/v1/auth/logout  (sends the httpOnly refresh cookie
 *      via credentials:'include' → server revokes it + clears it)
 *   2. clearAccessToken()        (drop the in-memory token — the bug
 *      the old command-palette signOut missed)
 *   3. queryClient.clear()       (no stale authed data after switch)
 *   4. toast + redirect to /login
 *
 * a11y: aria-haspopup/expanded, Esc + click-outside close, focus
 * rings, motion respects the reduced-motion preference via framer.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { ChevronDown, Compass, Inbox, LogOut, SlidersHorizontal } from 'lucide-react';
import { useAuthToken } from '../lib/use-auth-token';
import { clearAccessToken } from '../lib/auth-store';
import { cn } from '../lib/cn';
import { toast } from './ui/toast';

interface MenuLink {
  readonly href: Route;
  readonly label: string;
  readonly icon: typeof Compass;
}

const LINKS: readonly MenuLink[] = [
  { href: '/feed', label: 'Feed', icon: Compass },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/account/preferences', label: 'Preferences', icon: SlidersHorizontal },
];

export function UserMenu() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data } = useAuthControllerMe({ query: { enabled: token !== null } });
  const me = data?.data as unknown as WhoAmIResponseDto | undefined;

  // Close on outside-click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://127.0.0.1:3000';
      await fetch(`${apiBase}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      /* best-effort — the cookie is httpOnly; server revokes server-side */
    }
    clearAccessToken();
    queryClient.clear();
    setOpen(false);
    toast.success('Signed out');
    router.replace('/login' as Route);
    setBusy(false);
  }, [busy, queryClient, router]);

  // Signed out — a restrained, premium entry point.
  if (token === null) {
    return (
      <Link
        href={'/login' as Route}
        className="rounded-full border border-gold-600/40 px-3.5 py-1.5 text-sm font-medium text-surface-foreground transition hover:border-gold-600 hover:shadow-(--shadow-glow) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Sign in
      </Link>
    );
  }

  const initial = (me?.role ?? me?.sub ?? '?').charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-full p-0.5 pr-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          className="grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white shadow-(--shadow-depth-2) ring-2 ring-gold-500/60 transition group-hover:ring-gold-500"
          style={{ backgroundImage: 'var(--gradient-royal)' }}
        >
          {initial}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-gold-600/15 bg-surface/95 shadow-(--shadow-depth-3) backdrop-blur-xl"
          >
            <div
              className="border-b border-muted/10 px-4 py-3"
              style={{ backgroundImage: 'var(--gradient-royal)' }}
            >
              <p className="font-display text-base font-semibold text-white">
                {me?.role ? me.role.charAt(0).toUpperCase() + me.role.slice(1) : 'Traveller'}
              </p>
              <code className="font-mono text-[11px] text-white/70">
                {me?.sub ? `${me.sub.slice(0, 12)}…` : 'signed in'}
              </code>
            </div>

            <nav className="p-1.5">
              {LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-surface-foreground transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon aria-hidden className="h-4 w-4 text-gold-600" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-muted/10 p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut()}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                {busy ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
