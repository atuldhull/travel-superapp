/**
 * V.UX.38 — /ops dashboard. Polls /health/live + /health/ready +
 * /health/startup directly (these are @Public on the api side and
 * sit OUTSIDE the /api/v1 prefix). Renders the per-dep status with
 * tone-coded tiles + the seeded force-purge button.
 *
 * The force-purge button is rendered for everyone in the role-gate
 * but only ENABLED for `role==='admin'` callers — the api gates
 * /admin/account-purge at @Roles('admin'). sre/compliance see a
 * tooltip explaining why the button is disabled.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band). Semantic traffic-light status
 * colours (emerald up / rose down) are deliberately preserved.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Zap } from 'lucide-react';
import {
  useAdminPurgeControllerForcePurge,
  useAuthControllerMe,
  type WhoAmIResponseDto,
} from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';

interface HealthLive {
  status: 'ok';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

interface IndicatorPayload {
  status: string;
  latencyMs?: number;
  bucketStatus?: string;
  error?: string;
}

interface HealthReadyResp {
  status: string;
  info?: Record<string, IndicatorPayload>;
  error?: Record<string, IndicatorPayload>;
  details?: Record<string, IndicatorPayload>;
}

interface ProbeState {
  liveStatus: 'pending' | 'up' | 'down';
  liveUptime: number | null;
  liveError: string | null;
  ready: HealthReadyResp | null;
  readyHttpStatus: number | null;
  readyError: string | null;
  startup: HealthReadyResp | null;
  startupHttpStatus: number | null;
  fetchedAt: string | null;
}

const initialState: ProbeState = {
  liveStatus: 'pending',
  liveUptime: null,
  liveError: null,
  ready: null,
  readyHttpStatus: null,
  readyError: null,
  startup: null,
  startupHttpStatus: null,
  fetchedAt: null,
};

function StatusPill({
  label,
  state,
  detail,
}: {
  label: string;
  state: 'up' | 'down' | 'pending';
  detail?: string;
}) {
  // Traffic-light semantics are load-bearing here — keep emerald (up)
  // and rose (down); only the neutral/pending tone moves to gold.
  const cls =
    state === 'up'
      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : state === 'down'
        ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
        : 'bg-surface border-gold-600/25 text-muted';
  const icon = state === 'up' ? '●' : state === 'down' ? '✕' : '…';
  return (
    <div className={`rounded-2xl border ${cls} p-4 shadow-(--shadow-depth-1)`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">
        {icon} {state}
      </p>
      {detail ? <p className="mt-1 text-[11px] opacity-80">{detail}</p> : null}
    </div>
  );
}

export default function OpsDashboardPage() {
  const [state, setState] = useState<ProbeState>(initialState);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const { data: meData } = useAuthControllerMe();
  const me = meData?.data as unknown as WhoAmIResponseDto | undefined;
  const isAdmin = me?.role === 'admin';

  const fetchAll = useCallback(async () => {
    const next: ProbeState = { ...initialState, fetchedAt: new Date().toISOString() };
    try {
      const r = await fetch(`${API_BASE}/health/live`, { cache: 'no-store' });
      if (r.ok) {
        const body = (await r.json()) as HealthLive;
        next.liveStatus = 'up';
        next.liveUptime = body.uptimeSeconds;
      } else {
        next.liveStatus = 'down';
        next.liveError = `HTTP ${r.status}`;
      }
    } catch (err) {
      next.liveStatus = 'down';
      next.liveError = err instanceof Error ? err.message : String(err);
    }
    try {
      const r = await fetch(`${API_BASE}/health/ready`, { cache: 'no-store' });
      next.readyHttpStatus = r.status;
      const body = (await r.json()) as HealthReadyResp;
      next.ready = body;
    } catch (err) {
      next.readyError = err instanceof Error ? err.message : String(err);
    }
    try {
      const r = await fetch(`${API_BASE}/health/startup`, { cache: 'no-store' });
      next.startupHttpStatus = r.status;
      const body = (await r.json()) as HealthReadyResp;
      next.startup = body;
    } catch {
      // best-effort
    }
    setState(next);
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = window.setInterval(() => {
      void fetchAll();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  const purgeMut = useAdminPurgeControllerForcePurge({
    mutation: {
      onSuccess: () => setPurgeMsg('Purge tick fired. Watch logs for the count.'),
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setPurgeMsg(`Failed: ${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? ''}`);
      },
    },
  });

  // Pull indicator details out of either info OR error (terminus
  // surfaces failed indicators under `error`, not `info`).
  function pickIndicator(key: string): IndicatorPayload | undefined {
    if (!state.ready) return undefined;
    return state.ready.info?.[key] ?? state.ready.error?.[key] ?? state.ready.details?.[key];
  }

  function indicatorState(
    key: string,
    useBucketStatus = false,
  ): {
    state: 'up' | 'down' | 'pending';
    detail?: string;
  } {
    const ind = pickIndicator(key);
    if (!ind) return { state: 'pending' };
    const status = useBucketStatus ? (ind.bucketStatus ?? ind.status) : ind.status;
    const detail = [
      ind.latencyMs !== undefined ? `${ind.latencyMs}ms` : null,
      ind.error ? `err: ${ind.error}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      state: status === 'up' ? 'up' : 'down',
      ...(detail ? { detail } : {}),
    };
  }

  const dbState = indicatorState('postgres');
  const redisState = indicatorState('redis');
  const meiliState = indicatorState('meilisearch');
  const startupOk = state.startupHttpStatus === 200;

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
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
              <Activity aria-hidden className="h-3.5 w-3.5" /> System health
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Ops dashboard
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/65">
              Auto-refresh every 15s.
              {state.fetchedAt ? ` Last: ${new Date(state.fetchedAt).toLocaleTimeString()}.` : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void fetchAll();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          >
            <RefreshCw aria-hidden className="h-4 w-4" /> Refresh now
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Probes</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <StatusPill
            label="Liveness"
            state={state.liveStatus}
            detail={
              state.liveUptime !== null
                ? `uptime ${state.liveUptime}s`
                : (state.liveError ?? undefined)
            }
          />
          <StatusPill
            label="Readiness (HTTP)"
            state={
              state.readyHttpStatus === 200
                ? 'up'
                : state.readyHttpStatus !== null
                  ? 'down'
                  : 'pending'
            }
            detail={
              state.readyHttpStatus !== null
                ? `HTTP ${state.readyHttpStatus}`
                : (state.readyError ?? undefined)
            }
          />
          <StatusPill
            label="Startup"
            state={startupOk ? 'up' : state.startupHttpStatus !== null ? 'down' : 'pending'}
            detail={
              state.startupHttpStatus !== null ? `HTTP ${state.startupHttpStatus}` : undefined
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Dependencies</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <StatusPill
            label="Postgres"
            state={dbState.state}
            {...(dbState.detail ? { detail: dbState.detail } : {})}
          />
          <StatusPill
            label="Redis"
            state={redisState.state}
            {...(redisState.detail ? { detail: redisState.detail } : {})}
          />
          <StatusPill
            label="Meilisearch"
            state={meiliState.state}
            {...(meiliState.detail ? { detail: meiliState.detail } : {})}
          />
        </div>
      </section>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Force actions</CardTitle>
          <CardSubtitle>
            Force-purge wraps the AccountPurgeScheduler tick — idempotent + re-entrant guard.
          </CardSubtitle>
        </CardHeader>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!isAdmin || purgeMut.isPending}
            onClick={() => purgeMut.mutate()}
            title={
              isAdmin
                ? 'Fires the AccountPurgeScheduler immediately.'
                : 'Force-purge is admin-only. compliance + sre can read but not run.'
            }
          >
            <Zap aria-hidden className="mr-1.5 h-3.5 w-3.5" />
            {purgeMut.isPending ? 'Firing…' : 'Force account-purge'}
          </Button>
          {!isAdmin ? (
            <span className="text-[11px] text-muted">
              ({me?.role ?? 'unknown'}) — admin role required.
            </span>
          ) : null}
        </div>
        {purgeMsg ? (
          <p
            className="mt-3 rounded-2xl border border-gold-600/25 bg-surface p-3 text-xs text-surface-foreground"
            role="status"
            aria-live="polite"
          >
            {purgeMsg}
          </p>
        ) : null}
      </Card>

      {state.ready ? (
        <details className="rounded-2xl border border-gold-600/25 bg-surface p-4 text-xs shadow-(--shadow-depth-1)">
          <summary className="cursor-pointer font-medium text-muted transition hover:text-gold-600">
            Raw /health/ready payload
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-surface-foreground">
            {JSON.stringify(state.ready, null, 2)}
          </pre>
        </details>
      ) : null}
    </main>
  );
}
