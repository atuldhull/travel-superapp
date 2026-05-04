/**
 * V.UX.37 — compliance shell. Wraps every /compliance/* route with:
 *
 *   1. A sticky blue "Compliance mode" ribbon (read-only role).
 *   2. A role gate — only `compliance` + `admin` callers; everyone
 *      else (anon / user / premium / agent) sees a 403 panel.
 *   3. A subnav linking the 2 sections (Retention + Takedowns).
 *
 * Compliance is intentionally a separate ribbon (blue) from admin
 * (red) so an op never confuses "I'm reading data" with
 * "I'm taking destructive action".
 */
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

const COMPLIANCE_ROLES = new Set(['compliance', 'admin']);

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/compliance', label: 'Retention' },
  { href: '/compliance/takedowns', label: 'Takedowns' },
];

export default function ComplianceLayout({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const { data, isLoading } = useAuthControllerMe({
    query: { enabled: token !== null },
  });
  const me = data?.data as unknown as WhoAmIResponseDto | undefined;
  const allowed = me ? COMPLIANCE_ROLES.has(me.role) : false;

  if (!bootComplete) {
    return <p className="text-sm text-muted">Restoring your session…</p>;
  }
  if (token === null) {
    return (
      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
        <p className="font-semibold text-sky-700 dark:text-sky-300">Sign-in required</p>
        <p className="mt-1 text-muted">
          You need to be signed in as a compliance officer to view this section.{' '}
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
  if (!allowed) {
    return (
      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
        <p className="font-semibold text-sky-700 dark:text-sky-300">403 — Compliance only</p>
        <p className="mt-1 text-muted">
          This area is reserved for accounts with the <code>compliance</code> or <code>admin</code>{' '}
          role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="-mx-6 -mt-10 mb-4 flex items-center justify-center gap-2 bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-md"
      >
        <span aria-hidden>📋</span>
        <span>Compliance mode — read-only access. Reports are auditable.</span>
      </div>
      <nav
        aria-label="Compliance sections"
        className="flex flex-wrap gap-2 border-b border-muted/15 pb-3"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href as never}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs font-medium hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
