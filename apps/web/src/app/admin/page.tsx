/**
 * V.UX.36 — admin dashboard. Shows current counts across the
 * moderation surfaces (pending scam reports, active SOS, recent
 * audit log activity) so an op landing here knows where to look.
 *
 * Each tile links to its respective queue. Counts are pulled
 * from the same typed list endpoints the queues use, so any
 * permissions/role drift here surfaces consistently.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold
 * tokens, font-display, cinematic header band, raised cards).
 */
'use client';

import Link from 'next/link';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import {
  useAdminAuditLogsControllerList,
  useAdminScamModerationControllerList,
  useAdminSosControllerList,
  useAdminUsersControllerList,
  useAdminUsersControllerListAppeals,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

interface TileProps {
  readonly href: string;
  readonly title: string;
  readonly count: number | undefined;
  readonly subtitle: string;
}

function Tile({ href, title, count, subtitle }: TileProps) {
  return (
    <Card as="li" depth="raised" interactive className="group p-0">
      <Link
        href={href as never}
        className="block rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-gold-600"
          />
        </div>
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-surface-foreground">
          {count === undefined ? '—' : count}
        </p>
        <p className="mt-1 text-xs text-muted">{subtitle}</p>
      </Link>
    </Card>
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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /trips + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Moderation
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Admin dashboard
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Live counts across the moderation surfaces. Click a tile to triage.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="text-xl">Queues</CardTitle>
          <CardSubtitle>
            Where the work is right now — open a surface to start triaging.
          </CardSubtitle>
        </CardHeader>
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Tile
            href="/admin/scam-reports"
            title="Pending scam reports"
            count={scamCount}
            subtitle="Reports awaiting verify / dismiss."
          />
          <Tile
            href="/admin/sos"
            title="Active SOS"
            count={sosCount}
            subtitle="Unresolved SOS events. Resolve once safe out-of-band."
          />
          <Tile
            href="/admin/users"
            title="Pending appeals"
            count={appealsTotal}
            subtitle="Ban appeals awaiting review."
          />
          <Tile
            href="/admin/users"
            title="Total users"
            count={usersTotal}
            subtitle="All users in the system."
          />
          <Tile
            href="/admin/audit"
            title="Audit log entries"
            count={auditTotal}
            subtitle="Total admin actions logged. Read-only history."
          />
        </ul>
      </Card>
    </main>
  );
}
