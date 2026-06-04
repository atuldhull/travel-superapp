/**
 * V.UX.36 — admin scam-reports queue. List pending reports +
 * verify / dismiss inline. Each action emits an audit row server-side
 * (V.UX.36 retrofit on `VerifyScamReportUseCase` /
 * `DismissScamReportUseCase`).
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band). Semantic traffic-light severity
 * colours are preserved as safety signal.
 */
'use client';

import { useState } from 'react';
import { Check, ShieldAlert, Trash2 } from 'lucide-react';
import {
  getAdminScamModerationControllerListQueryKey,
  useAdminScamModerationControllerDismiss,
  useAdminScamModerationControllerList,
  useAdminScamModerationControllerVerify,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

interface ScamReport {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: string;
  readonly description: string;
  readonly verified: boolean;
  readonly createdAt: string;
}

/** Map a severity to a semantic traffic-light Badge variant — this is
 *  safety signal, so the colour stays meaningful (not gold-washed). */
function severityVariant(severity: string): 'success' | 'gold' | 'danger' | 'neutral' {
  switch (severity.toLowerCase()) {
    case 'low':
      return 'success';
    case 'medium':
      return 'gold';
    case 'high':
    case 'critical':
      return 'danger';
    default:
      return 'neutral';
  }
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
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Moderation queue
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Scam reports
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/65">
              Verified reports surface on the public scam map.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur-sm">
            <input
              type="checkbox"
              checked={showVerified}
              onChange={(e) => setShowVerified(e.target.checked)}
              className="accent-gold-600"
            />
            Show verified pile
          </label>
        </div>
      </header>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">No reports in this queue.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base font-semibold tracking-tight text-surface-foreground">
                  {r.category}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>
                  {r.verified ? (
                    <Badge variant="success">✓ verified</Badge>
                  ) : (
                    <Badge variant="neutral">pending</Badge>
                  )}
                </span>
              </div>
              <p className="mt-2 text-sm text-surface-foreground">{r.description}</p>
              <p className="mt-2 text-[11px] text-muted">
                Reporter <code>{r.reporterId.slice(0, 10)}…</code> ·{' '}
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="royal"
                  size="sm"
                  disabled={r.verified}
                  loading={verifyMut.isPending}
                  onClick={() => verifyMut.mutate({ id: r.id })}
                >
                  <Check aria-hidden className="h-3.5 w-3.5" /> Verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={dismissMut.isPending}
                  onClick={() => {
                    if (window.confirm('Dismiss (hard delete) this report?')) {
                      dismissMut.mutate({ id: r.id });
                    }
                  }}
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
