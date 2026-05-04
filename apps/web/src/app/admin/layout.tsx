/**
 * V.UX.36 — admin shell. Wraps every /admin/* route with:
 *
 *   1. A sticky red "Admin mode" ribbon (top of viewport, always
 *      visible) so an op never forgets which authority they're
 *      acting under.
 *   2. A role gate — non-admin callers (anon + user + premium +
 *      agent) see a 403 panel. The api also gates every admin
 *      route, so this is defense-in-depth, not the only check.
 *   3. A subnav linking to every queue (dashboard / scam reports /
 *      sos / users / media / audit log).
 *
 * Pure client component — auth role lives in the JWT, surfaced
 * via /auth/me. The api-side @Roles('admin') guard is the source
 * of truth.
 */
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/scam-reports', label: 'Scam reports' },
  { href: '/admin/sos', label: 'SOS triage' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const { data, isLoading } = useAuthControllerMe({
    query: { enabled: token !== null },
  });
  const me = data?.data as unknown as WhoAmIResponseDto | undefined;
  const isAdmin = me?.role === 'admin';

  if (!bootComplete) {
    return <p className="text-sm text-muted">Restoring your session…</p>;
  }
  if (token === null) {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
        <p className="font-semibold text-rose-700 dark:text-rose-300">Sign-in required</p>
        <p className="mt-1 text-muted">
          You need to be signed in as an admin to view this section.{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }
  if (token !== null && isLoading) {
    return <p className="text-sm text-muted">Checking your permissions…</p>;
  }
  if (!isAdmin) {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
        <p className="font-semibold text-rose-700 dark:text-rose-300">403 — Admins only</p>
        <p className="mt-1 text-muted">
          This area is reserved for accounts with the <code>admin</code> role. If you believe this
          is a mistake, contact the team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="-mx-6 -mt-10 mb-4 flex items-center justify-center gap-2 bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow-md"
      >
        <span aria-hidden>⚠️</span>
        <span>Admin mode — every action is logged to the audit trail.</span>
      </div>
      <nav
        aria-label="Admin sections"
        className="flex flex-wrap gap-2 border-b border-muted/15 pb-3"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href as never}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs font-medium hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
