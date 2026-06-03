/**
 * V.UX.32 — account hub. Index page that links to every caller-self
 * surface: privacy (export + delete + stats), preferences (V.UX.14
 * family / V.UX.15 comfort / V.UX.16 budget / V.UX.23 nomad), trusted
 * contacts (V.UX.13).
 *
 * Auth-gated client redirect — the underlying surfaces are already
 * auth-only, but bouncing here saves a round-trip.
 *
 * Installed by prompt [V.UX.32]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, cinematic header
 * band, iconified hub cards).
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Bell,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface HubLink {
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: LucideIcon;
}

const LINKS: readonly HubLink[] = [
  {
    href: '/account/privacy',
    title: 'Privacy & data',
    subtitle: 'See what we store, export it, or delete the account.',
    icon: ShieldCheck,
  },
  {
    href: '/account/preferences',
    title: 'Preferences',
    subtitle: 'Family / comfort / budget / nomad mode + per-trip filters.',
    icon: SlidersHorizontal,
  },
  {
    // Phase 1 (C2) — re-run the Travel Aura quiz / update home + interests.
    href: '/onboarding?tour=true',
    title: 'Travel style & home',
    subtitle: 'Retake the 30-sec Travel Aura quiz, update your home city & interests.',
    icon: Sparkles,
  },
  {
    href: '/account/trusted-contacts',
    title: 'Trusted contacts',
    subtitle: 'Up to 3 people we notify when you trigger SOS.',
    icon: Users,
  },
  {
    href: '/inbox',
    title: 'Notifications',
    subtitle: 'Inbox + per-category preferences + Web Push subscription.',
    icon: Bell,
  },
  {
    // POST.9 — Premium subscription + Stripe Customer Portal.
    href: '/account/billing',
    title: 'Billing',
    subtitle: 'Manage your Premium subscription, payment method, and invoices.',
    icon: CreditCard,
  },
];

export default function AccountHubPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  if (!bootComplete) return <p className="text-sm text-muted">Restoring your session…</p>;
  if (token === null) return <p className="text-sm text-muted">Redirecting to sign in…</p>;

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <UserCog aria-hidden className="h-3.5 w-3.5" /> Your account
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Account
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Everything that&apos;s yours, in one place.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Card as="li" key={l.href} depth="raised" interactive className="group">
              <Link
                href={l.href as never}
                className="flex items-start gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-700 transition group-hover:border-gold-500/40 group-hover:bg-gold-500/15 dark:text-gold-300"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <CardHeader className="flex-1">
                  <CardTitle className="flex items-center justify-between gap-2 text-lg">
                    {l.title}
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-gold-600"
                    />
                  </CardTitle>
                  <CardSubtitle>{l.subtitle}</CardSubtitle>
                </CardHeader>
              </Link>
            </Card>
          );
        })}
      </ul>
    </main>
  );
}
