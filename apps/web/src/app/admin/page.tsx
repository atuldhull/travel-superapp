/**
 * V.UX.36 — admin dashboard. Shows current counts across the
 * moderation surfaces (pending scam reports, active SOS, recent
 * audit log activity) so an op landing here knows where to look.
 *
 * Each tile links to its respective queue. Counts are pulled
 * from the same typed list endpoints the queues use, so any
 * permissions/role drift here surfaces consistently.
 */
'use client';

import Link from 'next/link';
import {
  useAdminAuditLogsControllerList,
  useAdminScamModerationControllerList,
  useAdminSosControllerList,
  useAdminUsersControllerList,
  useAdminUsersControllerListAppeals,
} from '@app/sdk';

interface TileProps {
  readonly href: string;
  readonly title: string;
  readonly count: number | undefined;
  readonly subtitle: string;
}

function Tile({ href, title, count, subtitle }: TileProps) {
  return (
    <Link
      href={href as never}
      className="block rounded-lg border border-muted/20 bg-surface p-4 shadow-sm transition hover:border-rose-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400"
    >
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{count === undefined ? '—' : count}</p>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const scams = useAdminScamModerationControllerList({} as never);
  const activeSos = useAdminSosControllerList({ status: 'active' } as never);
  const recentAudit = useAdminAuditLogsControllerList({ limit: '1' } as never);
  const allUsers = useAdminUsersControllerList({ limit: '1' } as never);
  const pendingAppeals = useAdminUsersControllerListAppeals({
    status: 'pending',
    limit: '1',
  } as never);

  const scamCount = (scams.data?.data as { reports?: unknown[] } | undefined)?.reports?.length;
  const sosCount = (activeSos.data?.data as { total?: number } | undefined)?.total;
  const auditTotal = (recentAudit.data?.data as { total?: number } | undefined)?.total;
  const usersTotal = (allUsers.data?.data as { total?: number } | undefined)?.total;
  const appealsTotal = (pendingAppeals.data?.data as { total?: number } | undefined)?.total;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Live counts across the moderation surfaces. Click a tile to triage.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <li>
          <Tile
            href="/admin/scam-reports"
            title="Pending scam reports"
            count={scamCount}
            subtitle="Reports awaiting verify / dismiss."
          />
        </li>
        <li>
          <Tile
            href="/admin/sos"
            title="Active SOS"
            count={sosCount}
            subtitle="Unresolved SOS events. Resolve once safe out-of-band."
          />
        </li>
        <li>
          <Tile
            href="/admin/users"
            title="Pending appeals"
            count={appealsTotal}
            subtitle="Ban appeals awaiting review."
          />
        </li>
        <li>
          <Tile
            href="/admin/users"
            title="Total users"
            count={usersTotal}
            subtitle="All users in the system."
          />
        </li>
        <li>
          <Tile
            href="/admin/audit"
            title="Audit log entries"
            count={auditTotal}
            subtitle="Total admin actions logged. Read-only history."
          />
        </li>
      </ul>
    </div>
  );
}
