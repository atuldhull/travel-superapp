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
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  useAdminPurgeControllerForcePurge,
  useAuthControllerMe,
  type WhoAmIResponseDto,
} from '@app/sdk';

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
  const cls =
    state === 'up'
      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700'
      : state === 'down'
        ? 'bg-rose-500/10 border-rose-500/40 text-rose-700'
        : 'bg-muted/10 border-muted/30 text-muted';
  const icon = state === 'up' ? '●' : state === 'down' ? '✕' : '…';
  return (
    <div className={`rounded-lg border ${cls} p-3`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">
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
  const s3State = indicatorState('s3', true);
  const startupOk = state.startupHttpStatus === 200;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ops dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Auto-refresh every 15s.
            {state.fetchedAt ? ` Last: ${new Date(state.fetchedAt).toLocaleTimeString()}.` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void fetchAll();
          }}
          className="rounded-md border border-purple-500 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/10"
        >
          Refresh now
        </button>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Probes</h2>
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

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Dependencies
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
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
          <StatusPill
            label="S3 (soft)"
            state={s3State.state}
            {...(s3State.detail ? { detail: s3State.detail } : {})}
          />
        </div>
      </section>

      <section className="rounded-lg border border-muted/15 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Force actions</h2>
        <p className="mt-1 text-xs text-muted">
          Force-purge wraps the AccountPurgeScheduler tick — idempotent + re-entrant guard.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isAdmin || purgeMut.isPending}
            onClick={() => purgeMut.mutate()}
            title={
              isAdmin
                ? 'Fires the AccountPurgeScheduler immediately.'
                : 'Force-purge is admin-only. compliance + sre can read but not run.'
            }
            className="rounded-md border border-rose-500 bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {purgeMut.isPending ? 'Firing…' : 'Force account-purge'}
          </button>
          {!isAdmin ? (
            <span className="text-[11px] text-muted">
              ({me?.role ?? 'unknown'}) — admin role required.
            </span>
          ) : null}
        </div>
        {purgeMsg ? (
          <p
            className="mt-2 rounded-md border border-muted/15 bg-muted/5 p-2 text-xs"
            role="status"
            aria-live="polite"
          >
            {purgeMsg}
          </p>
        ) : null}
      </section>

      {state.ready ? (
        <details className="rounded-md border border-muted/15 p-3 text-xs">
          <summary className="cursor-pointer text-muted">Raw /health/ready payload</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(state.ready, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
