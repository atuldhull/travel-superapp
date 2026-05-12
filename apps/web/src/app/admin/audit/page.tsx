/**
 * V.UX.36 — admin audit log page. Read-only, paginated, filterable
 * by actor / target / action. Newest-first.
 *
 * The audit trail is append-only by design — there is no way to
 * edit or delete a row from this surface. Even the page itself
 * has no mutation hooks.
 */
'use client';

import { useState } from 'react';
import { useAdminAuditLogsControllerList } from '@app/sdk';
import { EmptyState } from '../../../components/ui/empty-state';
import { RelativeTime } from '../../../components/ui/relative-time';
import { SkeletonList } from '../../../components/ui/skeleton';

interface AuditRow {
  readonly id: string;
  readonly actorId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context: Record<string, unknown> | null;
  readonly createdAt: string;
}

const ACTIONS = [
  '',
  'ban',
  'unban',
  'verify_scam',
  'dismiss_scam',
  'resolve_sos',
  'delete_trip',
  'archive_trip',
  'delete_media',
] as const;

const TARGET_TYPES = ['', 'user', 'scam_report', 'sos', 'trip', 'media'] as const;

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const [actorId, setActorId] = useState('');
  const [targetType, setTargetType] = useState<(typeof TARGET_TYPES)[number]>('');
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('');
  const [page, setPage] = useState(0);

  const params = {
    ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
    ...(targetType ? { targetType } : {}),
    ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
    ...(action ? { action } : {}),
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  const list = useAdminAuditLogsControllerList(params as never);
  const data = list.data?.data as { rows?: AuditRow[]; total?: number } | undefined;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  function clearFilters() {
    setActorId('');
    setTargetType('');
    setTargetId('');
    setAction('');
    setPage(0);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted">{total} total entries · append-only · newest first.</p>
      </header>

      <div className="grid gap-2 rounded-md border border-muted/15 bg-surface p-3 text-xs sm:grid-cols-2 md:grid-cols-4">
        <label className="space-y-1">
          <span className="block text-muted">Actor user-id</span>
          <input
            type="text"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(0);
            }}
            placeholder="cuid"
            className="w-full rounded border border-muted/15 bg-surface px-2 py-1"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-muted">Target type</span>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as (typeof TARGET_TYPES)[number]);
              setPage(0);
            }}
            className="w-full rounded border border-muted/15 bg-surface px-2 py-1"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t || 'any'} value={t}>
                {t || '— any —'}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-muted">Target id</span>
          <input
            type="text"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setPage(0);
            }}
            placeholder="cuid"
            className="w-full rounded border border-muted/15 bg-surface px-2 py-1"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-muted">Action</span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as (typeof ACTIONS)[number]);
              setPage(0);
            }}
            className="w-full rounded border border-muted/15 bg-surface px-2 py-1"
          >
            {ACTIONS.map((a) => (
              <option key={a || 'any'} value={a}>
                {a || '— any —'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={clearFilters}
          className="col-span-full justify-self-start rounded-md border border-muted/15 px-3 py-1 text-xs"
        >
          Clear filters
        </button>
      </div>

      {list.isLoading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No audit rows match these filters"
          body="Try clearing the filters above or expanding the date range."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-muted/15">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/5 text-muted">
              <tr>
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Actor</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Target</th>
                <th className="px-2 py-2">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-muted/10">
                  <td className="px-2 py-2 text-[10px]">
                    <RelativeTime at={r.createdAt} />
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {r.actorId ? `${r.actorId.slice(0, 12)}…` : <em>(deleted)</em>}
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-700">
                      {r.action}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {r.targetType}/{r.targetId.slice(0, 12)}…
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {r.context ? JSON.stringify(r.context) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-muted/15 px-3 py-1 disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-muted/15 px-3 py-1 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
