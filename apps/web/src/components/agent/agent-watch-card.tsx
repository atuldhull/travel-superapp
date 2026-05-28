/**
 * POST.2A.5 + [S-C2] — the agent's surface on /trips/[id].
 *
 * Flag-gated by NEXT_PUBLIC_FEATURE_AGENT_ENABLED (mirrors the
 * server FEATURE_AGENT_ENABLED). When OFF it renders `null` — ZERO
 * new UI, no layout shift on the 58 existing pages (the critical
 * AC).
 *
 * When ON, this surface now LIVE-WIRES to the agent backend via
 * `useAgentControllerListTripProposalsRoute` ([S-C2] endpoint):
 *
 *   - `run === null` → no active watch → "watching" empty state
 *     (matches the original POST.2A.5 surface; identical when the
 *     agent hasn't started a run for this trip yet).
 *   - `proposals.length === 0` → run active but no open proposals →
 *     "watching, nothing to act on" success state.
 *   - `proposals.length > 0` → render each pending proposal with
 *     ✓ Accept / ✗ Decline buttons. Accept fires
 *     `useAgentControllerAcceptProposal`; decline fires
 *     `useAgentControllerDeclineProposal`. Both invalidate the list
 *     query so the resolved proposal disappears.
 *
 * LAW 2 / human-in-the-loop: nothing is autonomous. Every accept /
 * decline writes an append-only step to AgentStep (handled server-
 * side by ConfirmReplanUseCase); the run history is preserved.
 *
 * Polls every 30s while the page is visible (React Query default
 * staleTime + an explicit refetchInterval). Future evolution to
 * WebTransport-push is one of the [`docs/aether/02-surfaces.md`]
 * v2 Pulse signals.
 *
 * Installed by prompt [POST.2A.5]; live-wired by [S-C2].
 */
'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  getAgentControllerListTripProposalsRouteQueryKey,
  useAgentControllerAcceptProposal,
  useAgentControllerDeclineProposal,
  useAgentControllerListTripProposalsRoute,
} from '@app/sdk';
import { Button } from '../ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

const AGENT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_AGENT_ENABLED === 'true';

interface ProposalDetailLite {
  readonly summary?: string;
  readonly reason?: string;
}

interface ProposalLite {
  readonly id: string;
  readonly kind: string;
  readonly detail: ProposalDetailLite | null;
  readonly createdAt: string;
}

interface ProposalsBody {
  readonly run: { readonly id: string; readonly planVersion: number } | null;
  readonly proposals: readonly ProposalLite[];
}

export function AgentWatchCard({ tripId }: { readonly tripId: string }) {
  // Flag off → nothing renders. This is what keeps every existing
  // page byte-identical until the agent is deliberately switched on.
  if (!AGENT_ENABLED) return null;
  return <ActiveWatchCard tripId={tripId} />;
}

function ActiveWatchCard({ tripId }: { readonly tripId: string }) {
  const queryClient = useQueryClient();
  const query = useAgentControllerListTripProposalsRoute(tripId, {
    query: {
      // Poll every 30s — cheap on the server (proposals are scarce)
      // and the user gets near-real-time updates without WebTransport.
      refetchInterval: 30_000,
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getAgentControllerListTripProposalsRouteQueryKey(tripId),
    });

  const accept = useAgentControllerAcceptProposal({
    mutation: { onSuccess: () => void invalidate() },
  });
  const decline = useAgentControllerDeclineProposal({
    mutation: { onSuccess: () => void invalidate() },
  });

  const body = query.data?.data as unknown as ProposalsBody | undefined;
  const run = body?.run ?? null;
  const proposals = body?.proposals ?? [];

  return (
    <Card aria-label="Trip agent" data-trip-id={tripId}>
      <CardHeader>
        <CardTitle>🤖 Trip agent</CardTitle>
      </CardHeader>
      <CardBody>
        {run === null ? (
          <EmptyState
            emoji="🛰️"
            title="Watching this trip"
            body="The agent watches for weather and schedule changes during your trip. If something material changes it will suggest a re-plan and ask you to confirm — it never changes your trip on its own."
          />
        ) : proposals.length === 0 ? (
          <EmptyState
            emoji="✓"
            title="Watching — nothing to act on"
            body={`Plan version ${run.planVersion}. The agent is observing weather, schedule, and signal changes. You'll see proposals here when something material changes.`}
          />
        ) : (
          <ul className="space-y-3">
            {proposals.map((p) => (
              <li key={p.id}>
                <ProposalRow
                  proposal={p}
                  isPending={
                    (accept.isPending && accept.variables?.id === p.id) ||
                    (decline.isPending && decline.variables?.id === p.id)
                  }
                  onAccept={() => accept.mutate({ id: p.id })}
                  onDecline={() => decline.mutate({ id: p.id })}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ProposalRow({
  proposal,
  isPending,
  onAccept,
  onDecline,
}: {
  readonly proposal: ProposalLite;
  readonly isPending: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}) {
  const detail = proposal.detail ?? {};
  const summary = detail.summary ?? 'Re-plan proposal';
  const reason = detail.reason ?? null;
  const created = new Date(proposal.createdAt);
  return (
    <div className="rounded-md border border-muted/20 bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">{summary}</p>
          {reason ? <p className="mt-0.5 text-xs text-muted">{reason}</p> : null}
          <p className="mt-1 text-[10px] text-muted">
            Proposed {created.toLocaleString()} · id{' '}
            <code className="font-mono">{proposal.id.slice(0, 8)}…</code>
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={isPending} onClick={onAccept}>
          {isPending ? 'Working…' : '✓ Accept'}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={onDecline}>
          ✗ Decline
        </Button>
      </div>
    </div>
  );
}
