/**
 * V.UX.37 — compliance retention dashboard. Renders the 16 indexed
 * counts the api computes (users / trips / safety / inbox / appeals)
 * + the oldest soft-delete date + days-until-purge for that row.
 *
 * Read-only by design. The "scheduled for purge" count matches what
 * the AccountPurgeScheduler will hard-delete on the next tick.
 */
'use client';

import { useComplianceControllerRetention, type RetentionStatsResponseDto } from '@app/sdk';

interface CountTileProps {
  readonly label: string;
  readonly value: number | null;
  readonly hint?: string;
  readonly tone?: 'neutral' | 'warn' | 'danger';
}

function CountTile({ label, value, hint, tone = 'neutral' }: CountTileProps) {
  const toneCls =
    tone === 'danger'
      ? 'border-rose-400 bg-rose-500/10'
      : tone === 'warn'
        ? 'border-amber-400 bg-amber-500/10'
        : 'border-muted/20 bg-surface';
  return (
    <div className={`rounded-lg border ${toneCls} p-3`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value ?? '—'}</p>
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Retention dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Retention window: <strong>{stats.retentionDays} days</strong>. Snapshot computed{' '}
          {new Date(stats.computedAt).toLocaleString()}.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Users</h2>
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
            className={`mt-3 rounded-md border p-3 text-xs ${
              purgeWarning
                ? 'border-rose-400 bg-rose-500/10 text-rose-700'
                : 'border-muted/15 text-muted'
            }`}
          >
            Oldest soft-delete: {new Date(oldestSoftDeleteAt).toLocaleString()} ·{' '}
            {daysUntilPurge !== null
              ? `${daysUntilPurge} day${daysUntilPurge === 1 ? '' : 's'} until purge`
              : 'overdue'}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Trips</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile label="Total" value={stats.trips.total} />
          <CountTile label="Archived" value={stats.trips.archived} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Safety</h2>
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
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Inbox</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile label="Notifications" value={stats.inbox.notifications} />
          <CountTile label="Archived" value={stats.inbox.archivedNotifications} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Ban appeals
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <CountTile
            label="Pending"
            value={stats.appeals.pending}
            tone={stats.appeals.pending > 0 ? 'warn' : 'neutral'}
          />
          <CountTile label="Approved" value={stats.appeals.approved} />
          <CountTile label="Rejected" value={stats.appeals.rejected} />
        </div>
      </section>
    </div>
  );
}
