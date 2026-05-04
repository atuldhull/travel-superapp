/**
 * V.UX.40 — landing-page live-metrics strip. Polls the @Public
 * `/metrics-public` endpoint (5-min cached server-side, fuzzed
 * under 1000) and renders 3 counters with subtle entrance animation.
 */
'use client';

import type { ReactElement } from 'react';
import { motion } from 'framer-motion';
import { usePublicMetricsControllerGet, type PublicMetricsResponseDto } from '@app/sdk';

interface CounterProps {
  readonly label: string;
  readonly value: number | undefined;
  readonly delaySec: number;
}

function Counter({ label, value, delaySec }: CounterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delaySec, duration: 0.4 }}
      className="rounded-lg border border-muted/15 bg-surface p-4 text-center"
    >
      <p className="text-3xl font-bold tabular-nums">
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</p>
    </motion.div>
  );
}

export function LiveMetricsStrip(): ReactElement {
  const q = usePublicMetricsControllerGet();
  const m = q.data?.data as unknown as PublicMetricsResponseDto | undefined;

  return (
    <section
      aria-label="Live activity"
      className="rounded-lg border border-muted/15 bg-linear-to-br from-brand/10 to-brand/0 p-4"
    >
      <p className="mb-3 text-xs uppercase tracking-wide text-muted">
        Live activity (anonymized, 5-min cache)
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Counter label="Trips this month" value={m?.tripsThisMonth} delaySec={0} />
        <Counter label="Memory books this month" value={m?.memoryBooksThisMonth} delaySec={0.1} />
        <Counter label="Active travelers this week" value={m?.activeUsersThisWeek} delaySec={0.2} />
      </div>
    </section>
  );
}
