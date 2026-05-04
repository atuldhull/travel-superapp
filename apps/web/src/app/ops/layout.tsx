/**
 * V.UX.38 — /ops/* shell. Role gate to admin | compliance | sre.
 *
 * Sticky purple "Ops mode" ribbon (distinct from V.UX.36 admin red
 * + V.UX.37 compliance blue) so an oncall visually distinguishes
 * "I'm reading system health" from "I'm taking destructive
 * moderation action".
 *
 * Force-purge is the only destructive action surfaced under /ops;
 * the api gates that endpoint at @Roles('admin'), so the button
 * on /ops/page.tsx is rendered disabled for sre/compliance and
 * enabled only when role==='admin'.
 */
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

const OPS_ROLES = new Set(['admin', 'compliance', 'sre']);

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/ops', label: 'Dashboard' },
  { href: '/ops/runbooks', label: 'Runbooks' },
];

export default function OpsLayout({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const { data, isLoading } = useAuthControllerMe({
    query: { enabled: token !== null },
  });
  const me = data?.data as unknown as WhoAmIResponseDto | undefined;
  const allowed = me ? OPS_ROLES.has(me.role) : false;

  if (!bootComplete) {
    return <p className="text-sm text-muted">Restoring your session…</p>;
  }
  if (token === null) {
    return (
      <div className="rounded-md border border-purple-500/40 bg-purple-500/10 p-4 text-sm">
        <p className="font-semibold text-purple-700 dark:text-purple-300">Sign-in required</p>
        <p className="mt-1 text-muted">
          You need to be signed in as admin/compliance/sre to view this section.{' '}
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
      <div className="rounded-md border border-purple-500/40 bg-purple-500/10 p-4 text-sm">
        <p className="font-semibold text-purple-700 dark:text-purple-300">403 — Ops only</p>
        <p className="mt-1 text-muted">
          This area is reserved for accounts with the <code>admin</code>, <code>compliance</code>,
          or <code>sre</code> role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="-mx-6 -mt-10 mb-4 flex items-center justify-center gap-2 bg-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-md"
      >
        <span aria-hidden>🛠️</span>
        <span>Ops mode — health probes + runbooks. Destructive actions are admin-only.</span>
      </div>
      <nav aria-label="Ops sections" className="flex flex-wrap gap-2 border-b border-muted/15 pb-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href as never}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs font-medium hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
