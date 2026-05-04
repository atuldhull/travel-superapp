/**
 * V.UX.36 — admin scam-reports queue. List pending reports +
 * verify / dismiss inline. Each action emits an audit row server-side
 * (V.UX.36 retrofit on `VerifyScamReportUseCase` /
 * `DismissScamReportUseCase`).
 */
'use client';

import { useState } from 'react';
import {
  getAdminScamModerationControllerListQueryKey,
  useAdminScamModerationControllerDismiss,
  useAdminScamModerationControllerList,
  useAdminScamModerationControllerVerify,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';

interface ScamReport {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: string;
  readonly description: string;
  readonly verified: boolean;
  readonly createdAt: string;
}

export default function AdminScamReportsPage() {
  const [showVerified, setShowVerified] = useState(false);
  const qc = useQueryClient();
  const queryParams = (showVerified ? { verified: 'true' } : {}) as never;
  const list = useAdminScamModerationControllerList(queryParams);
  const reports = (list.data?.data as { reports?: ScamReport[] } | undefined)?.reports ?? [];

  const verifyMut = useAdminScamModerationControllerVerify({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: getAdminScamModerationControllerListQueryKey(queryParams),
        });
      },
    },
  });
  const dismissMut = useAdminScamModerationControllerDismiss({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: getAdminScamModerationControllerListQueryKey(queryParams),
        });
      },
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scam reports</h1>
          <p className="text-sm text-muted">Verified reports surface on the public scam map.</p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showVerified}
            onChange={(e) => setShowVerified(e.target.checked)}
          />
          Show verified pile
        </label>
      </header>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="rounded-md border border-muted/15 p-3 text-sm text-muted">
          No reports in this queue.
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-md border border-muted/15 bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.category}</span>
                <span className="text-xs uppercase tracking-wide text-muted">
                  {r.severity} · {r.verified ? '✓ verified' : 'pending'}
                </span>
              </div>
              <p className="mt-1 text-sm">{r.description}</p>
              <p className="mt-2 text-[11px] text-muted">
                Reporter <code>{r.reporterId.slice(0, 10)}…</code> ·{' '}
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={r.verified || verifyMut.isPending}
                  onClick={() => verifyMut.mutate({ id: r.id })}
                  className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  disabled={dismissMut.isPending}
                  onClick={() => {
                    if (window.confirm('Dismiss (hard delete) this report?')) {
                      dismissMut.mutate({ id: r.id });
                    }
                  }}
                  className="rounded-md border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
