/**
 * POST.6 — Status page. Polls the api's /health/ready endpoint every
 * 30s and shows a coloured dot per dependency (postgres, redis,
 * meilisearch, s3). 90-day uptime is a placeholder until [POST.10]
 * wires real observability.
 *
 * Why fetch directly (not via the SDK): /health/ready is mounted at
 * the root path (no /api/v1 prefix) so the k8s liveness probe pattern
 * stays clean. The endpoint is public — no token needed.
 */
'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://127.0.0.1:3000';
const POLL_INTERVAL_MS = 30_000;

type DepStatus = 'up' | 'degraded' | 'down' | 'unknown';

interface DepRow {
  readonly name: string;
  readonly key: string; // matches the key in /health/ready info/error blocks
  readonly status: DepStatus;
}

interface HealthSnapshot {
  readonly fetchedAt: number;
  readonly overall: DepStatus;
  readonly deps: readonly DepRow[];
  readonly error?: string;
}

const DEP_DEFINITIONS: readonly { readonly name: string; readonly key: string }[] = [
  { name: 'Postgres', key: 'postgres' },
  { name: 'Redis', key: 'redis' },
  { name: 'Meilisearch', key: 'meilisearch' },
];

function colourFor(s: DepStatus): string {
  switch (s) {
    case 'up':
      return 'bg-emerald-500';
    case 'degraded':
      return 'bg-amber-500';
    case 'down':
      return 'bg-rose-500';
    case 'unknown':
      return 'bg-muted/40';
  }
}

function labelFor(s: DepStatus): string {
  switch (s) {
    case 'up':
      return 'Operational';
    case 'degraded':
      return 'Degraded';
    case 'down':
      return 'Down';
    case 'unknown':
      return 'Unknown';
  }
}

interface HealthRawResponse {
  readonly status?: string;
  readonly info?: Record<string, { readonly status?: string }>;
  readonly error?: Record<string, { readonly status?: string }>;
  readonly details?: Record<string, { readonly status?: string }>;
}

function classifyDep(raw: HealthRawResponse, key: string): DepStatus {
  const info = raw.info?.[key];
  if (info?.status === 'up') return 'up';
  const err = raw.error?.[key];
  if (err) return 'down';
  const det = raw.details?.[key];
  if (det?.status === 'up') return 'up';
  if (det?.status === 'down') return 'down';
  return 'unknown';
}

export default function StatusPage() {
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API_BASE}/health/ready`, { cache: 'no-store' });
        const body = (await res.json()) as HealthRawResponse;
        if (cancelled) return;
        const deps: DepRow[] = DEP_DEFINITIONS.map((d) => ({
          name: d.name,
          key: d.key,
          status: classifyDep(body, d.key),
        }));
        const overall: DepStatus = deps.some((d) => d.status === 'down')
          ? 'down'
          : deps.some((d) => d.status === 'degraded' || d.status === 'unknown')
            ? 'degraded'
            : 'up';
        setSnap({ fetchedAt: Date.now(), overall, deps });
      } catch (err) {
        if (cancelled) return;
        setSnap({
          fetchedAt: Date.now(),
          overall: 'down',
          deps: DEP_DEFINITIONS.map((d) => ({ name: d.name, key: d.key, status: 'unknown' })),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    void fetchOnce();
    const handle = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  return (
    <section className="space-y-6" aria-labelledby="status-h1">
      <header className="space-y-2">
        <h1 id="status-h1" className="text-3xl font-bold tracking-tight">
          System status
        </h1>
        <p className="text-sm text-muted">
          Live readiness probe — refreshes every 30 seconds. For incident history, watch our{' '}
          <a
            href="https://github.com/atuldhull/travel-app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            GitHub
          </a>{' '}
          repo until the public incident log lands.
        </p>
      </header>

      <article
        className={
          'rounded-md border p-4 ' +
          (snap === null
            ? 'border-muted/15 bg-muted/5'
            : snap.overall === 'up'
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : snap.overall === 'degraded'
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-rose-500/40 bg-rose-500/5')
        }
      >
        <div className="flex items-center gap-3">
          <span
            className={'inline-block h-3 w-3 rounded-full ' + colourFor(snap?.overall ?? 'unknown')}
            aria-hidden
          />
          <h2 className="text-base font-semibold">
            {snap === null
              ? 'Checking…'
              : snap.overall === 'up'
                ? 'All systems operational'
                : snap.overall === 'degraded'
                  ? 'Partial degradation'
                  : 'Major outage'}
          </h2>
        </div>
        {snap?.error ? (
          <p className="mt-1 text-xs text-rose-500">Probe error: {snap.error}</p>
        ) : null}
        {snap !== null ? (
          <p className="mt-1 text-[11px] text-muted">
            Last checked {new Date(snap.fetchedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </article>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Dependencies</h2>
        <ul className="space-y-2" role="list">
          {(
            snap?.deps ?? DEP_DEFINITIONS.map((d) => ({ ...d, status: 'unknown' as DepStatus }))
          ).map((d) => (
            <li
              key={d.key}
              className="flex items-center justify-between rounded-md border border-muted/15 bg-surface px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={'inline-block h-2.5 w-2.5 rounded-full ' + colourFor(d.status)}
                  aria-hidden
                />
                <span>{d.name}</span>
              </div>
              <span className="text-xs text-muted">{labelFor(d.status)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">90-day uptime</h2>
        <div className="rounded-md border border-muted/15 bg-muted/5 p-4 text-xs text-muted">
          Real uptime metrics arrive with our observability rollout. For now we surface live probes
          only. If you need a guaranteed SLA for an enterprise deployment, see{' '}
          <a
            href="mailto:sales@travel.local?subject=Enterprise%20SLA"
            className="underline-offset-2 hover:underline"
          >
            sales@travel.local
          </a>
          .
        </div>
      </section>
    </section>
  );
}
