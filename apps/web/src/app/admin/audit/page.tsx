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
import { ScrollText } from 'lucide-react';
import { useAdminAuditLogsControllerList } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
import { RelativeTime } from '../../../components/ui/relative-time';
import { SkeletonList } from '../../../components/ui/skeleton';

// Shared filter-field styling so every control reads as one gold set.
const FIELD =
  'w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

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
          <ScrollText aria-hidden className="h-3.5 w-3.5" /> Admin
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Audit log
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          {total} total entries · append-only · newest first.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Filters</CardTitle>
          <CardSubtitle>Narrow the trail by actor, target, or action.</CardSubtitle>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-xs text-muted">Actor user-id</span>
            <input
              type="text"
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setPage(0);
              }}
              placeholder="cuid"
              className={FIELD}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Target type</span>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as (typeof TARGET_TYPES)[number]);
                setPage(0);
              }}
              className={FIELD}
            >
              {TARGET_TYPES.map((t) => (
                <option key={t || 'any'} value={t}>
                  {t || '— any —'}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Target id</span>
            <input
              type="text"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setPage(0);
              }}
              placeholder="cuid"
              className={FIELD}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Action</span>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as (typeof ACTIONS)[number]);
                setPage(0);
              }}
              className={FIELD}
            >
              {ACTIONS.map((a) => (
                <option key={a || 'any'} value={a}>
                  {a || '— any —'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </Card>

      {list.isLoading ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No audit rows match these filters"
          body="Try clearing the filters above or expanding the date range."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold-600/12 bg-surface shadow-(--shadow-depth-1)">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gold-600/15 bg-gold-500/5 text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">When</th>
                <th className="px-3 py-2.5 font-medium">Actor</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 font-medium">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gold-600/10 transition hover:bg-gold-500/5"
                >
                  <td className="px-3 py-2.5 text-[10px]">
                    <RelativeTime at={r.createdAt} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px]">
                    {r.actorId ? `${r.actorId.slice(0, 12)}…` : <em>(deleted)</em>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="gold">{r.action}</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px]">
                    {r.targetType}/{r.targetId.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px]">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </main>
  );
}
