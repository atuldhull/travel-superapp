/**
 * /admin/agent-kyc — agent-KYC moderation queue.
 *
 * Closes E5 UI half of the Z2 E-block. Backend wired in `[S-E5/be]`:
 *   - GET    /admin/agents?status=pending|verified|rejected
 *   - POST   /admin/agents/:id/verify
 *   - POST   /admin/agents/:id/reject (reason required)
 *
 * Status-tab switcher (pending / verified / rejected) so the same
 * page also serves "see what I already approved / rejected." Verify
 * is one-click (no confirm card — the audit row is the safety net).
 * Reject opens an inline reason textarea; rejection without a reason
 * 400s server-side.
 *
 * Installed by [S-E5/ui] of the S-series real-functionality closeout.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminAgentsControllerList,
  useAdminAgentsControllerReject,
  useAdminAgentsControllerVerify,
  type AdminAgentDto,
  type AdminListAgentsResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

type Status = 'pending' | 'verified' | 'rejected';

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const KYC_TONE: Record<Status, string> = {
  pending: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  verified: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  rejected: 'border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400',
};

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function AgentKycPage() {
  const [status, setStatus] = useState<Status>('pending');
  const limit = 50;
  const offset = 0;
  const queryClient = useQueryClient();

  const params = { status, limit: String(limit), offset: String(offset) };
  const listQuery = useAdminAgentsControllerList(params);

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/agents'] });

  const verify = useAdminAgentsControllerVerify({
    mutation: {
      onSuccess: () => {
        void invalidateAll();
      },
    },
  });

  const reject = useAdminAgentsControllerReject({
    mutation: {
      onSuccess: () => {
        void invalidateAll();
      },
    },
  });

  const body = listQuery.data?.data as unknown as AdminListAgentsResponseDto | undefined;
  const agents = body?.agents ?? [];
  const total = body?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-xs text-muted underline-offset-2 hover:underline">
          ← Admin dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Agent KYC</h1>
        <p className="text-sm text-muted">
          Verify or reject agent KYC. Verifications stamp `verifiedAt = now`; rejections require a
          reason that's preserved in the audit log. Slack pings on both via the E6 webhook.
        </p>
      </header>

      <div role="tablist" aria-label="KYC status" className="flex flex-wrap gap-1">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => {
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(s)}
              className={
                'rounded-md border px-3 py-1.5 text-sm font-medium transition ' +
                (active
                  ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 dark:text-gold-300'
                  : 'border-muted/30 text-muted hover:bg-muted/5')
              }
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
        <div className="ml-auto flex items-center text-xs text-muted">
          {listQuery.isLoading ? 'Loading…' : `${total} total`}
        </div>
      </div>

      {listQuery.isLoading ? (
        <Skeleton className="h-32" count={3} />
      ) : listQuery.isError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          Couldn't load agents —{' '}
          {(listQuery.error as ApiError)?.code ??
            `HTTP_${(listQuery.error as ApiError)?.status ?? '???'}`}
          .
        </p>
      ) : agents.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No agents in the {STATUS_LABELS[status].toLowerCase()} pile.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {agents.map((a) => (
            <li key={a.id}>
              <AgentRow
                agent={a as AdminAgentDto}
                onVerify={() => verify.mutate({ id: a.id })}
                onReject={(reason: string) => reject.mutate({ id: a.id, data: { reason } })}
                pendingId={
                  verify.isPending || reject.isPending
                    ? (verify.variables?.id ?? reject.variables?.id)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AgentRowProps {
  readonly agent: AdminAgentDto;
  readonly onVerify: () => void;
  readonly onReject: (reason: string) => void;
  readonly pendingId: string | undefined;
}

function AgentRow({ agent, onVerify, onReject, pendingId }: AgentRowProps) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const isMine = pendingId === agent.id;
  const kyc = agent.kycStatus as unknown as Status;
  const verifiedAt = agent.verifiedAt as unknown as string | null;
  const bio = agent.bio as unknown as string | null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{agent.displayName}</CardTitle>
            <CardSubtitle>
              <span
                className={
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                  KYC_TONE[kyc]
                }
              >
                KYC {kyc}
              </span>
              {verifiedAt ? ` · verified ${new Date(verifiedAt).toLocaleDateString()}` : ''} · ★{' '}
              {agent.ratingAverage.toFixed(1)} ({agent.ratingCount}) · created{' '}
              {new Date(agent.createdAt).toLocaleDateString()}
            </CardSubtitle>
          </div>
          {kyc === 'pending' ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={isMine} onClick={onVerify}>
                {isMine ? 'Verifying…' : '✓ Verify'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReject((v) => !v)}
                className="text-red-600 dark:text-red-400"
              >
                ✗ Reject…
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      {bio ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{bio}</p>
      ) : (
        <p className="text-sm text-muted/70">No bio yet.</p>
      )}
      <p className="mt-2 flex flex-wrap gap-1">
        {agent.languages.map((l) => (
          <Badge key={`lang:${l}`} variant="neutral">
            {l}
          </Badge>
        ))}
        {agent.regions.map((r) => (
          <Badge key={`reg:${r}`} variant="brand">
            {r}
          </Badge>
        ))}
      </p>

      {showReject ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`reason-${agent.id}`} className="block text-xs font-medium">
            Rejection reason (1-280 chars, recorded in audit log)
          </label>
          <textarea
            id={`reason-${agent.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            minLength={1}
            maxLength={280}
            placeholder="What's wrong with the KYC submission?"
            className="w-full rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/40"
          />
          <p className="text-[11px] text-muted">{reason.trim().length} / 280</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={isMine || reason.trim().length === 0}
              onClick={() => {
                onReject(reason.trim());
                setShowReject(false);
                setReason('');
              }}
              className="bg-red-600 text-white hover:opacity-90"
            >
              {isMine ? 'Rejecting…' : 'Confirm reject'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReject(false);
                setReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] text-muted">
        Agent id: <code className="font-mono">{agent.id}</code> · user id:{' '}
        <code className="font-mono">{agent.userId}</code>
      </p>
    </Card>
  );
}
