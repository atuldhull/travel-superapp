/**
 * V.UX.37 — compliance takedowns page. Read-only paginated table of
 * AdminAuditLog rows scoped to user-content takedown actions
 * (delete_media / delete_trip / archive_trip / dismiss_scam).
 *
 * "Export CSV" pulls up to 500 rows in a single fetch and triggers
 * a client-side download via Blob + URL.createObjectURL — same
 * pattern as the V.UX.32 export flow on /account/privacy.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, royal header band) — presentation only.
 */
'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ShieldCheck } from 'lucide-react';
import { useComplianceControllerTakedowns, type TakedownListResponseDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';

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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Compliance
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Takedown report
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/65">
              {total} entries · delete_media / delete_trip / archive_trip / dismiss_scam.
            </p>
          </div>
          <Button
            type="button"
            variant="royal"
            size="sm"
            disabled={exporting || total === 0}
            onClick={() => {
              void exportCsv();
            }}
          >
            <Download aria-hidden className="mr-1.5 h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV (up to 500 rows)'}
          </Button>
        </div>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">No takedown actions on record.</p>
        </Card>
      ) : (
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="font-display text-xl">Audit log</CardTitle>
            <CardSubtitle>Read-only record of moderation actions on user content.</CardSubtitle>
          </CardHeader>
          <div className="overflow-x-auto rounded-2xl border border-gold-600/12">
            <table className="w-full text-left text-xs">
              <thead className="bg-gold-500/8 text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Context</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gold-600/12 transition hover:bg-gold-500/5"
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-surface-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">
                      {r.actorId ? `${r.actorId.slice(0, 12)}…` : <em>(deleted)</em>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="gold">{r.action}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">
                      {r.targetType}/{r.targetId.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">
                      {r.context ? JSON.stringify(r.context) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
            <ChevronLeft aria-hidden className="mr-1 h-3.5 w-3.5" /> Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight aria-hidden className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </main>
  );
}
