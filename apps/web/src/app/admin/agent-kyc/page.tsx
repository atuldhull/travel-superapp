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
 * Installed by [S-E5/ui] of the S-series real-functionality closeout;
 * restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band).
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react';
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

const KYC_BADGE: Record<Status, 'gold' | 'success' | 'danger'> = {
  pending: 'gold',
  verified: 'success',
  rejected: 'danger',
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
    <main className="space-y-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Admin dashboard
      </Link>

      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Moderation queue
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Agent KYC
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Verify or reject agent KYC. Verifications stamp `verifiedAt = now`; rejections require a
          reason that&apos;s preserved in the audit log. Slack pings on both via the E6 webhook.
        </p>
      </header>

      <div role="tablist" aria-label="KYC status" className="flex flex-wrap gap-2">
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
                'rounded-2xl border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                (active
                  ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 dark:text-gold-300'
                  : 'border-gold-600/25 text-muted hover:border-gold-600/40 hover:bg-gold-500/5')
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
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn&apos;t load agents —{' '}
          {(listQuery.error as ApiError)?.code ??
            `HTTP_${(listQuery.error as ApiError)?.status ?? '???'}`}
          .
        </p>
      ) : agents.length === 0 ? (
        <Card depth="raised">
          <p className="text-sm text-muted">
            No agents in the {STATUS_LABELS[status].toLowerCase()} pile.
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
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
    </main>
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
    <Card depth="raised">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{agent.displayName}</CardTitle>
            <CardSubtitle>
              <Badge variant={KYC_BADGE[kyc]}>KYC {kyc}</Badge>
              {verifiedAt ? ` · verified ${new Date(verifiedAt).toLocaleDateString()}` : ''} · ★{' '}
              {agent.ratingAverage.toFixed(1)} ({agent.ratingCount}) · created{' '}
              {new Date(agent.createdAt).toLocaleDateString()}
            </CardSubtitle>
          </div>
          {kyc === 'pending' ? (
            <div className="flex gap-2">
              <Button variant="royal" size="sm" disabled={isMine} onClick={onVerify}>
                <Check aria-hidden className="h-3.5 w-3.5" />
                {isMine ? 'Verifying…' : 'Verify'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReject((v) => !v)}>
                <X aria-hidden className="h-3.5 w-3.5" />
                Reject…
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
          <Badge key={`reg:${r}`} variant="gold">
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
            className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
          />
          <p className="text-[11px] text-muted">{reason.trim().length} / 280</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={isMine || reason.trim().length === 0}
              onClick={() => {
                onReject(reason.trim());
                setShowReject(false);
                setReason('');
              }}
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
