/**
 * V.UX.32 — account hub. Index page that links to every caller-self
 * surface: privacy (export + delete + stats), preferences (V.UX.14
 * family / V.UX.15 comfort / V.UX.16 budget / V.UX.23 nomad), trusted
 * contacts (V.UX.13).
 *
 * Auth-gated client redirect — the underlying surfaces are already
 * auth-only, but bouncing here saves a round-trip.
 *
 * Installed by prompt [V.UX.32].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface HubLink {
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
}

const LINKS: readonly HubLink[] = [
  {
    href: '/account/privacy',
    title: 'Privacy & data',
    subtitle: 'See what we store, export it, or delete the account.',
  },
  {
    href: '/account/preferences',
    title: 'Preferences',
    subtitle: 'Family / comfort / budget / nomad mode + per-trip filters.',
  },
  {
    href: '/account/trusted-contacts',
    title: 'Trusted contacts',
    subtitle: 'Up to 3 people we notify when you trigger SOS.',
  },
  {
    href: '/inbox',
    title: 'Notifications',
    subtitle: 'Inbox + per-category preferences + Web Push subscription.',
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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted">Everything that&apos;s yours, in one place.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Card as="li" key={l.href}>
            <CardHeader>
              <CardTitle>
                <Link
                  href={l.href as never}
                  className="rounded outline-none hover:underline focus:ring-2 focus:ring-brand"
                >
                  {l.title} →
                </Link>
              </CardTitle>
              <CardSubtitle>{l.subtitle}</CardSubtitle>
            </CardHeader>
          </Card>
        ))}
      </ul>
    </div>
  );
}
