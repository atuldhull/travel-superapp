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
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, CircleDot, Compass, FileText, Flag, Radar, X } from 'lucide-react';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Skeleton } from '../../../../components/ui/skeleton';
import { RelativeTime } from '../../../../components/ui/relative-time';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { toast } from '../../../../components/ui/toast';

type IconType = typeof Compass;
const KIND_ICON: Record<string, IconType> = {
  watch_started: Compass,
  signal_seen: Radar,
  proposal: FileText,
  accepted: Check,
  declined: X,
  watch_closed: Flag,
};

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
  const reduce = useReducedMotion();

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
    <main className="space-y-8">
      <Link
        href={'/inbox' as Route}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Inbox
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Compass aria-hidden className="h-3.5 w-3.5" /> Your companion
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Trip agent
        </h1>
        <p className="relative mt-2 max-w-md text-sm text-white/65">
          It watches this trip and proposes changes — every change is yours to accept or decline.
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-14" count={4} />
      ) : disabled ? (
        <EmptyState
          emoji="🌙"
          title="The trip agent isn't enabled here"
          body="This environment runs with the agent switched off. Nothing to do — your trips are unaffected."
        />
      ) : error ? (
        <p
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-sm text-danger shadow-(--shadow-depth-1)"
        >
          Couldn&apos;t load this run ({error}).
        </p>
      ) : !view ? (
        <EmptyState emoji="🔍" title="Run not found" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1)">
            <div>
              <Link
                href={`/trips/${view.run.tripId}` as Route}
                className="font-display text-xl font-semibold tracking-tight transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Trip {view.run.tripId.slice(0, 8)}
              </Link>
              <p className="mt-0.5 text-sm text-muted">
                Plan v{view.run.planVersion} · started <RelativeTime at={view.run.createdAt} />
              </p>
            </div>
            <Badge variant={view.run.status === 'watching' ? 'success' : 'neutral'}>
              {view.run.status === 'watching' ? '● Watching' : 'Closed'}
            </Badge>
          </div>

          <motion.ol
            className="relative space-y-3 before:absolute before:bottom-3 before:left-[1.4rem] before:top-3 before:w-px before:bg-gold-600/20"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.06 } } }}
          >
            {view.steps.map((s) => {
              const pending = isPendingProposal(s);
              const summary =
                typeof s.detail?.['summary'] === 'string' ? (s.detail['summary'] as string) : null;
              const reason =
                typeof s.detail?.['reason'] === 'string' ? (s.detail['reason'] as string) : null;
              const Icon = KIND_ICON[s.kind] ?? CircleDot;
              return (
                <motion.li
                  key={s.id}
                  variants={{
                    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  className="relative flex gap-4 pl-1"
                >
                  <span
                    aria-hidden
                    className={`z-10 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-(--shadow-depth-1) ring-4 ring-surface ${
                      pending
                        ? 'text-brand-900'
                        : 'border border-gold-600/25 bg-surface text-gold-600'
                    }`}
                    style={pending ? { backgroundImage: 'var(--gradient-gold)' } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1)">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display font-semibold tracking-tight">
                        {KIND_LABEL[s.kind] ?? s.kind}
                      </span>
                      <RelativeTime at={s.createdAt} className="text-xs text-muted" />
                    </div>
                    {reason ? <p className="mt-1.5 text-sm text-muted">Why: {reason}</p> : null}
                    {summary ? (
                      <p className="mt-1.5 text-sm text-surface-foreground">{summary}</p>
                    ) : null}
                    {pending ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="royal"
                          onClick={() => void decide(s.id, 'accept')}
                          disabled={busyId !== null}
                        >
                          {busyId === s.id ? 'Working…' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void decide(s.id, 'decline')}
                          disabled={busyId !== null}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>
        </>
      )}
    </main>
  );
}
