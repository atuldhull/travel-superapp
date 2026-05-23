/**
 * AuraNudge — B4 existing-user parity. Members who signed up before
 * the Travel-Aura quiz existed (or skipped it) never saw it, so they
 * miss the personalization. This is a slim, dismissible, ONE-TIME
 * banner that invites them to take the 30-second quiz — shown only
 * when signed in AND the account has no Travel Aura yet.
 *
 * Never intrusive: hidden during the auth/onboarding flow itself,
 * dismiss is remembered, and any fetch failure renders nothing (the
 * app must never be blocked by a nudge).
 *
 * Installed for Phase 1 — Onboarding & Identity (B4).
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { preferencesControllerGetMine } from '@app/sdk';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import { getAuraDraft } from '../../lib/travel-aura';

const DISMISS_KEY = 'aura-nudge-dismissed';

export function AuraNudge() {
  const token = useAuthToken();
  const boot = useAuthBootComplete();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!boot || !token) return;
    // Don't nag inside the auth / setup flow itself.
    // F18 — also skip /home: the hub has its own welcome hero +
    // weather + safety sections, and stacking the nudge on top
    // makes the first-visit layout busy. Users can still set their
    // travel style from /trips/new's F8 CTA or from /account.
    if (pathname && /^\/(login|register|onboarding|home)/.test(pathname)) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* private mode — fall through */
    }
    if (getAuraDraft()) return; // set this session already
    let alive = true;
    void (async () => {
      try {
        const res = (await preferencesControllerGetMine()) as unknown as {
          data?: { travelAura?: string | null };
        };
        if (alive && !res?.data?.travelAura) setShow(true);
      } catch {
        /* never break the page on a nudge */
      }
    })();
    return () => {
      alive = false;
    };
  }, [boot, token, pathname]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* non-fatal */
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gold-600/25 bg-gold-500/10 px-4 py-3 text-sm shadow-(--shadow-depth-1)">
      <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
      <p className="flex-1 text-surface-foreground">
        Personalize your trips —{' '}
        <Link
          href={'/onboarding?tour=true' as never}
          className="font-medium text-gold-600 underline-offset-4 transition hover:underline"
        >
          take the 30-second Travel Style quiz
        </Link>{' '}
        to tune recommendations to you.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="rounded-full p-1 text-muted transition hover:bg-gold-500/15 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
