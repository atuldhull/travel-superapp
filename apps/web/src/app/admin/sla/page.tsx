/**
 * /admin/sla — moderation SLA dashboard.
 *
 * Closes E4 of the S-series E-block. The existing /admin dashboard
 * surfaces backlog counts; this page adds the SLA-aware metrics an
 * oncall operator actually needs:
 *
 *   - Backlog: count of items waiting per queue (same source as /admin).
 *   - Age of oldest pending: how long the most-stale row has been sitting.
 *   - Resolved (last 24h): action-count from the AdminAuditLog window.
 *
 * No new backend; everything is derived from existing typed list +
 * audit-log endpoints. The audit-log walk is bounded at 200 rows per
 * action — sufficient for shops up to ~200 moderation actions / day,
 * which is the practical solo-operator ceiling anyway.
 *
 * Installed by [S-E4] of the S-series real-functionality closeout.
 */
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gauge } from 'lucide-react';
import {
  useAdminAuditLogsControllerList,
  useAdminScamModerationControllerList,
  useAdminSosControllerList,
  useAdminUsersControllerListAppeals,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

interface SlaRow {
  readonly title: string;
  readonly href: string;
  readonly backlog: number | undefined;
  readonly oldestPendingMs: number | null;
  readonly resolved24h: number | undefined;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function formatAge(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < HOUR) return `${Math.round(ms / 60_000)}m`;
  if (ms < DAY) return `${(ms / HOUR).toFixed(1)}h`;
  return `${(ms / DAY).toFixed(1)}d`;
}

/** Status hint based on backlog age — operator sees red/amber/green at a glance. */
function ageTone(ms: number | null): 'ok' | 'warn' | 'crit' {
  if (ms === null) return 'ok';
  if (ms < 24 * HOUR) return 'ok';
  if (ms < 72 * HOUR) return 'warn';
  return 'crit';
}

const TONE: Record<'ok' | 'warn' | 'crit', string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  crit: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function SlaDashboardPage() {
  // We fetch a window of 50 pending items per queue so we can compute
  // the oldest-pending age without a dedicated endpoint. Bigger backlogs
  // still display the correct count (from the response total), just
  // with min-age accurate only across the first 50.
  const scamQuery = useAdminScamModerationControllerList({} as never);
  const sosQuery = useAdminSosControllerList({ status: 'active', limit: '50' } as never);
  const appealsQuery = useAdminUsersControllerListAppeals({
    status: 'pending',
    limit: '50',
  } as never);

  // Audit log — limit 200 covers the last day for any reasonable shop.
  // We compute the per-action 24h count client-side so we don't need a
  // new server-side aggregator endpoint.
  const auditQuery = useAdminAuditLogsControllerList({ limit: '200' } as never);

  const rows = useMemo<SlaRow[]>(() => {
    const cutoff = Date.now() - DAY;
    type AuditRow = { action: string; createdAt: string };
    const auditRows =
      (auditQuery.data?.data as { rows?: readonly AuditRow[] } | undefined)?.rows ?? [];
    const countByAction = new Map<string, number>();
    for (const r of auditRows) {
      if (new Date(r.createdAt).getTime() < cutoff) continue;
      countByAction.set(r.action, (countByAction.get(r.action) ?? 0) + 1);
    }

    type Scam = { id: string; createdAt: string; verified: boolean };
    type Sos = { id: string; createdAt: string };
    type Appeal = { id: string; createdAt: string };

    const scams = (
      (scamQuery.data?.data as { reports?: readonly Scam[] } | undefined)?.reports ?? []
    ).filter((r) => !r.verified);
    // True backlog now comes from the endpoint's `total` (the reports
    // array is capped at 200); fall back to the window length pre-deploy.
    const scamTotal =
      (scamQuery.data?.data as { total?: number } | undefined)?.total ?? scams.length;
    const sos =
      (sosQuery.data?.data as { events?: readonly Sos[]; total?: number } | undefined)?.events ??
      [];
    const sosTotal = (sosQuery.data?.data as { total?: number } | undefined)?.total ?? sos.length;
    const appeals =
      (appealsQuery.data?.data as { appeals?: readonly Appeal[]; total?: number } | undefined)
        ?.appeals ?? [];
    const appealsTotal =
      (appealsQuery.data?.data as { total?: number } | undefined)?.total ?? appeals.length;

    return [
      {
        title: 'Pending scam reports',
        href: '/admin/scam-reports',
        backlog: scamTotal,
        oldestPendingMs:
          scams.length === 0
            ? null
            : Date.now() - Math.min(...scams.map((s) => new Date(s.createdAt).getTime())),
        resolved24h:
          (countByAction.get('verify_scam') ?? 0) + (countByAction.get('dismiss_scam') ?? 0),
      },
      {
        title: 'Active SOS',
        href: '/admin/sos',
        backlog: sosTotal,
        oldestPendingMs:
          sos.length === 0
            ? null
            : Date.now() - Math.min(...sos.map((r) => new Date(r.createdAt).getTime())),
        resolved24h: countByAction.get('resolve_sos') ?? 0,
      },
      {
        title: 'Pending ban-appeals',
        href: '/admin/users',
        backlog: appealsTotal,
        oldestPendingMs:
          appeals.length === 0
            ? null
            : Date.now() - Math.min(...appeals.map((r) => new Date(r.createdAt).getTime())),
        // Bans + unbans both count as a "ban appeal touch" — the audit
        // log doesn't carry the appeal-id, so this is a coarse proxy.
        resolved24h: (countByAction.get('ban') ?? 0) + (countByAction.get('unban') ?? 0),
      },
    ];
  }, [scamQuery.data, sosQuery.data, appealsQuery.data, auditQuery.data]);

  const anyLoading =
    scamQuery.isLoading || sosQuery.isLoading || appealsQuery.isLoading || auditQuery.isLoading;

  return (
    <main className="space-y-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Admin dashboard
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
          <Gauge aria-hidden className="h-3.5 w-3.5" /> Oncall metrics
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SLA dashboard
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Backlog + oldest-pending age + resolved-in-last-24h per moderation queue. Counts accurate;
          ages bounded by the first 50 rows per queue. Resolutions are derived from the audit log
          (last 200 rows).
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {anyLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-32" />
              </li>
            ))
          : rows.map((row) => (
              <li key={row.title}>
                <SlaTile row={row} />
              </li>
            ))}
      </ul>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Tone thresholds</CardTitle>
          <CardSubtitle>
            Rules of thumb until SLO targets are formalised — adjust here when the team agrees on
            real numbers.
          </CardSubtitle>
        </CardHeader>
        <dl className="grid gap-1 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="success">ok</Badge>
            <span className="text-muted">oldest pending &lt; 24h</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                TONE.warn
              }
            >
              warn
            </span>
            <span className="text-muted">oldest pending 24h–72h</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                TONE.crit
              }
            >
              crit
            </span>
            <span className="text-muted">oldest pending ≥ 72h</span>
          </div>
        </dl>
      </Card>
    </main>
  );
}

function SlaTile({ row }: { row: SlaRow }) {
  const tone = ageTone(row.oldestPendingMs);
  return (
    <Link
      href={row.href as never}
      className={
        'block rounded-2xl border p-4 shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 ' +
        TONE[tone]
      }
    >
      <p className="text-xs uppercase tracking-wide opacity-80">{row.title}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums">
          {row.backlog === undefined ? '—' : row.backlog}
        </span>
        <span className="text-xs opacity-80">backlog</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
        <dt className="opacity-80">Oldest</dt>
        <dd className="text-right tabular-nums">{formatAge(row.oldestPendingMs)}</dd>
        <dt className="opacity-80">Resolved 24h</dt>
        <dd className="text-right tabular-nums">{row.resolved24h ?? '—'}</dd>
      </dl>
    </Link>
  );
}
