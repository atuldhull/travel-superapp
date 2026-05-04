/**
 * V.UX.37 — compliance takedowns page. Read-only paginated table of
 * AdminAuditLog rows scoped to user-content takedown actions
 * (delete_media / delete_trip / archive_trip / dismiss_scam).
 *
 * "Export CSV" pulls up to 500 rows in a single fetch and triggers
 * a client-side download via Blob + URL.createObjectURL — same
 * pattern as the V.UX.32 export flow on /account/privacy.
 */
'use client';

import { useState } from 'react';
import { useComplianceControllerTakedowns, type TakedownListResponseDto } from '@app/sdk';

interface TakedownRow {
  readonly id: string;
  readonly actorId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context: Record<string, unknown> | null;
  readonly createdAt: string;
}

const PAGE_SIZE = 50;

function csvEscape(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: readonly TakedownRow[]): string {
  const header = ['id', 'createdAt', 'actorId', 'action', 'targetType', 'targetId', 'context'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.createdAt),
        csvEscape(r.actorId),
        csvEscape(r.action),
        csvEscape(r.targetType),
        csvEscape(r.targetId),
        csvEscape(r.context ? JSON.stringify(r.context) : null),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export default function ComplianceTakedownsPage() {
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const params = {
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  const q = useComplianceControllerTakedowns(params as never);
  const data = q.data?.data as unknown as TakedownListResponseDto | undefined;
  const rows = (data?.rows ?? []) as TakedownRow[];
  const total = data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  async function exportCsv(): Promise<void> {
    if (exporting) return;
    setExporting(true);
    try {
      // Pull a wider page (limit=500) for the export. The api clamps
      // higher requests at 500.
      const exportParams = { limit: '500', offset: '0' };
      const { complianceControllerTakedowns } = await import('@app/sdk');
      const res = await complianceControllerTakedowns(exportParams as never);
      const exportData = (res as { data?: TakedownListResponseDto }).data;
      const allRows = (exportData?.rows ?? []) as TakedownRow[];
      const csv = rowsToCsv(allRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-takedowns-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Takedown report</h1>
          <p className="text-sm text-muted">
            {total} entries · delete_media / delete_trip / archive_trip / dismiss_scam.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || total === 0}
          onClick={() => {
            void exportCsv();
          }}
          className="rounded-md border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV (up to 500 rows)'}
        </button>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-muted/15 p-3 text-sm text-muted">
          No takedown actions on record.
        </p>
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
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {r.actorId ? `${r.actorId.slice(0, 12)}…` : <em>(deleted)</em>}
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-700">
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
