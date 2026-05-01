/**
 * V.UX.24 — full bookings list for the agent persona. Same source
 * as the dashboard's bookings card, but rendered standalone with a
 * wider window selector (30 / 90 / 365 days).
 *
 * Installed by prompt [V.UX.24].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAgentSelfControllerDashboard, type AgentDashboardDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
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
    <main className="space-y-6">
      <p>
        <Link href="/agent/dashboard" className="text-sm text-muted hover:underline">
          ← Back to dashboard
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>📅 Bookings</CardTitle>
          <CardSubtitle>All escrow holds the last {windowDays} days, newest first.</CardSubtitle>
        </CardHeader>
        <div className="mb-3 flex gap-2 text-xs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={`rounded-full border px-3 py-1 ${
                w === windowDays
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-muted/30 text-muted hover:bg-muted/10'
              }`}
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
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded border border-muted/15 p-2"
                >
                  <span className="font-mono text-xs text-muted">
                    {new Date(b.heldAt).toLocaleDateString()}
                  </span>
                  <span className="truncate font-mono text-[10px] opacity-50">{b.id}</span>
                  <span className="font-medium">${b.amountUsd}</span>
                  <Badge variant={b.state === 'released' ? 'brand' : 'neutral'}>{b.state}</Badge>
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
