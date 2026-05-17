/**
 * Landing-page live-metrics strip. Polls the @Public `/metrics-public`
 * endpoint (5-min cached server-side, fuzzed under 1000). Premium
 * royal rebuild: gold eyebrow, Playfair tabular counters on a royal
 * gradient panel, staggered entrance that respects reduced-motion.
 *
 * Installed by [V.UX.40]; premium rebuild for the royal frontend pass.
 */
'use client';

import type { ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePublicMetricsControllerGet, type PublicMetricsResponseDto } from '@app/sdk';

interface CounterProps {
  readonly label: string;
  readonly value: number | undefined;
  readonly delaySec: number;
  readonly reduce: boolean;
}

function Counter({ label, value, delaySec, reduce }: CounterProps) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: reduce ? 0 : delaySec, duration: 0.45, ease: 'easeOut' }}
      className="rounded-xl border border-gold-500/20 bg-white/5 p-5 text-center backdrop-blur-sm"
    >
      <p className="font-display text-3xl font-semibold tabular-nums text-white sm:text-4xl">
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-xs uppercase tracking-wide text-white/55">{label}</p>
    </motion.div>
  );
}

export function LiveMetricsStrip(): ReactElement {
  const q = usePublicMetricsControllerGet();
  const m = q.data?.data as unknown as PublicMetricsResponseDto | undefined;
  const reduce = !!useReducedMotion();

  return (
    <section
      aria-label="Live activity"
      className="relative isolate overflow-hidden rounded-2xl border border-gold-600/20 p-5 shadow-(--shadow-depth-2) sm:p-6"
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-500/15 blur-[100px]"
      />
      <p className="relative mb-4 text-xs font-medium uppercase tracking-wide text-gold-300">
        Live activity · anonymized · 5-min cache
      </p>
      <div className="relative grid gap-3.5 sm:grid-cols-3">
        <Counter label="Trips this month" value={m?.tripsThisMonth} delaySec={0} reduce={reduce} />
        <Counter
          label="Memory books this month"
          value={m?.memoryBooksThisMonth}
          delaySec={0.1}
          reduce={reduce}
        />
        <Counter
          label="Active travellers this week"
          value={m?.activeUsersThisWeek}
          delaySec={0.2}
          reduce={reduce}
        />
      </div>
    </section>
  );
}
