/**
 * V.UX.37 — compliance retention dashboard. Renders the 16 indexed
 * counts the api computes (users / trips / safety / inbox / appeals)
 * + the oldest soft-delete date + days-until-purge for that row.
 *
 * Read-only by design. The "scheduled for purge" count matches what
 * the AccountPurgeScheduler will hard-delete on the next tick.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band, raised stat cards).
 */
'use client';

import { ShieldAlert } from 'lucide-react';
import { useComplianceControllerRetention, type RetentionStatsResponseDto } from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

interface CountTileProps {
  readonly label: string;
  readonly value: number | null;
  readonly hint?: string;
  readonly tone?: 'neutral' | 'warn' | 'danger';
}

function CountTile({ label, value, hint, tone = 'neutral' }: CountTileProps) {
  const toneCls =
    tone === 'danger'
      ? 'border-danger/40 bg-danger/10'
      : tone === 'warn'
        ? 'border-gold-500/40 bg-gold-500/10'
        : 'border-gold-600/25 bg-surface';
  return (
    <div
      className={`rounded-2xl border ${toneCls} p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/30`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-surface-foreground">
        {value ?? '—'}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export default function ComplianceRetentionPage() {
  const q = useComplianceControllerRetention();
  const stats = q.data?.data as unknown as RetentionStatsResponseDto | undefined;

  if (q.isLoading) return <p className="text-sm text-muted">Loading retention stats…</p>;
  if (!stats) {
    return (
      <p className="text-sm text-muted">
        Couldn&apos;t load retention stats. Try again or contact engineering.
      </p>
    );
  }

  // Orval emits nullable scalars as `string | { [key: string]: unknown }`; cast at the boundary.
  const oldestSoftDeleteAt = stats.users.oldestSoftDeleteAt as unknown as string | null;
  const daysUntilPurge = stats.users.daysUntilPurgeForOldest as unknown as number | null;
  const purgeWarning = daysUntilPurge !== null && daysUntilPurge <= 1;

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /account + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Compliance · retention
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Retention dashboard
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Retention window: <strong className="text-white/85">{stats.retentionDays} days</strong>.
          Snapshot computed {new Date(stats.computedAt).toLocaleString()}.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardSubtitle>Lifecycle + GDPR purge eligibility.</CardSubtitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile label="Active" value={stats.users.active} />
          <CountTile
            label="Soft-deleted"
            value={stats.users.softDeleted}
            hint="Awaiting GDPR purge."
          />
          <CountTile
            label="Scheduled for purge"
            value={stats.users.scheduledForPurge}
            hint="Already eligible — next sweep tick deletes."
            tone={stats.users.scheduledForPurge > 0 ? 'warn' : 'neutral'}
          />
          <CountTile label="Banned" value={stats.users.banned} hint="Admin-driven moderation." />
        </div>
        {oldestSoftDeleteAt ? (
          <p
            className={`mt-4 rounded-2xl border p-4 text-xs shadow-(--shadow-depth-1) ${
              purgeWarning
                ? 'border-danger/40 bg-danger/10 text-danger'
                : 'border-gold-600/25 text-muted'
            }`}
          >
            Oldest soft-delete: {new Date(oldestSoftDeleteAt).toLocaleString()} ·{' '}
            {daysUntilPurge !== null
              ? `${daysUntilPurge} day${daysUntilPurge === 1 ? '' : 's'} until purge`
              : 'overdue'}
          </p>
        ) : null}
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Trips</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile label="Total" value={stats.trips.total} />
          <CountTile label="Archived" value={stats.trips.archived} />
        </div>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Safety</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile
            label="Active SOS"
            value={stats.safety.activeSos}
            tone={stats.safety.activeSos > 0 ? 'danger' : 'neutral'}
          />
          <CountTile label="Resolved SOS" value={stats.safety.resolvedSos} />
          <CountTile
            label="Pending scam reports"
            value={stats.safety.pendingScamReports}
            tone={stats.safety.pendingScamReports > 5 ? 'warn' : 'neutral'}
          />
          <CountTile label="Verified scams" value={stats.safety.verifiedScamReports} />
        </div>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile label="Notifications" value={stats.inbox.notifications} />
          <CountTile label="Archived" value={stats.inbox.archivedNotifications} />
        </div>
      </Card>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Ban appeals</CardTitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile
            label="Pending"
            value={stats.appeals.pending}
            tone={stats.appeals.pending > 0 ? 'warn' : 'neutral'}
          />
          <CountTile label="Approved" value={stats.appeals.approved} />
          <CountTile label="Rejected" value={stats.appeals.rejected} />
        </div>
      </Card>
    </main>
  );
}
