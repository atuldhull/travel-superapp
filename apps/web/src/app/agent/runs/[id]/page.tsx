/**
 * /agent/runs/[id] — the agent run surface (POST.2A.4/2A.5).
 *
 * Shows one AgentRun's append-only step timeline and, for any
 * still-pending proposal step, the human-in-the-loop Accept /
 * Decline actions (the ONLY way a re-plan takes effect — the agent
 * never acts autonomously, LAW 2). Reached via the
 * `trip_agent_replan_proposed` notification deep-link.
 *
 * Feature-off (`FEATURE_AGENT_ENABLED` unset) → the API answers 503
 * AGENT_DISABLED; we render a calm "not enabled here" state, never
 * an error (LAW 1: the whole thing is dark by default).
 *
 * apiFetch-direct via lib/two-oh-api (2.0 SDK regen is deferred).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useParams, useRouter } from 'next/navigation';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';
import {
  acceptProposal,
  declineProposal,
  getAgentRun,
  isAgentDisabled,
  type AgentRunView,
  type AgentStep,
} from '../../../../lib/two-oh-api';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Skeleton } from '../../../../components/ui/skeleton';
import { RelativeTime } from '../../../../components/ui/relative-time';
import { Button } from '../../../../components/ui/button';
import { toast } from '../../../../components/ui/toast';

const KIND_LABEL: Record<string, string> = {
  watch_started: 'Watch started',
  signal_seen: 'Signal checked',
  proposal: 'Re-plan proposed',
  accepted: 'You accepted',
  declined: 'You declined',
  watch_closed: 'Watch closed',
};

function isPendingProposal(s: AgentStep): boolean {
  return s.kind === 'proposal' && (s.detail?.['status'] as string | undefined) === 'pending';
}

export default function AgentRunPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const runId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [view, setView] = useState<AgentRunView | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setView(await getAgentRun(runId));
    } catch (err) {
      if (isAgentDisabled(err)) {
        setDisabled(true);
      } else {
        const e = err as { code?: string; status?: number };
        setError(e.code ?? `HTTP_${e.status ?? '???'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!bootComplete) return;
    if (token === null) {
      router.push(`/login?next=/agent/runs/${runId}` as Route);
      return;
    }
    if (runId) void load();
  }, [bootComplete, token, router, runId, load]);

  const decide = async (stepId: string, decision: 'accept' | 'decline') => {
    if (busyId) return;
    setBusyId(stepId);
    try {
      await (decision === 'accept' ? acceptProposal(stepId) : declineProposal(stepId));
      toast.success(decision === 'accept' ? 'Re-plan applied.' : 'Proposal declined.');
      await load();
    } catch (err) {
      const e = err as { code?: string; status?: number };
      toast.error(`Could not ${decision} (${e.code ?? e.status ?? 'error'}).`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="space-y-6">
      <p>
        <Link href={'/inbox' as Route} className="text-sm text-muted hover:underline">
          ← Inbox
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Trip agent</h1>
        <p className="text-sm text-muted">
          Your agent watches this trip and proposes changes — you decide.
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-5 w-2/3" count={4} />
      ) : disabled ? (
        <EmptyState
          emoji="🌙"
          title="The trip agent isn't enabled here"
          body="This environment runs with the agent switched off. Nothing to do — your trips are unaffected."
        />
      ) : error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          Couldn&apos;t load this run ({error}).
        </p>
      ) : !view ? (
        <EmptyState emoji="🔍" title="Run not found" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  <Link href={`/trips/${view.run.tripId}` as Route} className="hover:underline">
                    Trip {view.run.tripId.slice(0, 8)}
                  </Link>
                </CardTitle>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    view.run.status === 'watching'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-muted/30 bg-muted/10 text-muted'
                  }`}
                >
                  {view.run.status === 'watching' ? 'Watching' : 'Closed'}
                </span>
              </div>
              <CardSubtitle>
                Plan v{view.run.planVersion} · started <RelativeTime at={view.run.createdAt} />
              </CardSubtitle>
            </CardHeader>
          </Card>

          <ol className="space-y-2">
            {view.steps.map((s) => {
              const pending = isPendingProposal(s);
              const summary =
                typeof s.detail?.['summary'] === 'string' ? (s.detail['summary'] as string) : null;
              const reason =
                typeof s.detail?.['reason'] === 'string' ? (s.detail['reason'] as string) : null;
              return (
                <li
                  key={s.id}
                  className="rounded-md border border-muted/15 bg-surface px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{KIND_LABEL[s.kind] ?? s.kind}</span>
                    <RelativeTime at={s.createdAt} className="text-xs text-muted" />
                  </div>
                  {reason ? <p className="mt-1 text-muted">Why: {reason}</p> : null}
                  {summary ? <p className="mt-1">{summary}</p> : null}
                  {pending ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void decide(s.id, 'accept')}
                        disabled={busyId !== null}
                      >
                        {busyId === s.id ? 'Working…' : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void decide(s.id, 'decline')}
                        disabled={busyId !== null}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
