/**
 * V.UX.24 — full bookings list for the agent persona. Same source
 * as the dashboard's bookings card, but rendered standalone with a
 * wider window selector (30 / 90 / 365 days).
 *
 * Installed by prompt [V.UX.24]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, royal header band).
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
import { useAgentSelfControllerDashboard, type AgentDashboardDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/cn';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const WINDOWS = [30, 90, 365] as const;

export default function AgentBookingsPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useAgentSelfControllerDashboard(
    { windowDays },
    { query: { enabled: token !== null, retry: false } },
  );

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }
  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }

  const apiErr = error as ApiError | null;
  const body = data?.data as unknown as AgentDashboardDto | undefined;

  return (
    <main className="space-y-8">
      <Link
        href="/agent/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Receipt aria-hidden className="h-3.5 w-3.5" /> Escrow ledger
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Bookings
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          All escrow holds the last {windowDays} days, newest first.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Recent holds</CardTitle>
          <CardSubtitle>Pick a window to widen or narrow the ledger.</CardSubtitle>
        </CardHeader>
        <div className="mb-3 flex gap-2 text-xs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              aria-pressed={w === windowDays}
              className={cn(
                'rounded-full border px-3 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25',
                w === windowDays
                  ? 'border-gold-500 bg-gold-500/12 text-gold-700 dark:text-gold-300'
                  : 'border-gold-600/25 text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
              )}
            >
              Last {w} days
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-1/2" />
        ) : isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load bookings ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
          </p>
        ) : body ? (
          body.bookings.length === 0 ? (
            <p className="text-sm text-muted">No bookings in this window.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {body.bookings.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
                >
                  <span className="font-mono text-xs text-muted">
                    {new Date(b.heldAt).toLocaleDateString()}
                  </span>
                  <span className="truncate font-mono text-[10px] opacity-50">{b.id}</span>
                  <span className="font-display font-semibold tracking-tight text-surface-foreground">
                    ${b.amountUsd}
                  </span>
                  <Badge variant={b.state === 'released' ? 'gold' : 'neutral'}>{b.state}</Badge>
                </li>
              ))}
            </ul>
          )
        ) : null}
        {body ? (
          <p className="mt-3 text-xs text-muted">
            Gross: <span className="font-mono">${body.earnings.grossUsd}</span> ·{' '}
            {body.earnings.bookingsCount} booking{body.earnings.bookingsCount === 1 ? '' : 's'}.
          </p>
        ) : null}
      </Card>
    </main>
  );
}
