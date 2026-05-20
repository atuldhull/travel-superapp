/**
 * CompanionNudges — Phase 4 (H2) "real-time companion" nudges.
 *
 * A small stack of dismissable toasts rendered on /home that
 * surface time-sensitive context the user shouldn't have to dig
 * for. Every nudge is derived from data /home already has — no
 * extra fetches, no fabrication.
 *
 * Today's nudge set:
 *   • **Deadline reminder** — trip starts within 7 days. Mirrors
 *     the G5 deadline signal (same window).
 *   • **Rainy day** — first forecast day has precip ≥ 60%.
 *   • **Progress check** — past 50% of trip duration with <25% of
 *     today's items checked off. Only fires when there's a current
 *     trip with both `startsOn` and `endsOn` set.
 *   • **Cold snap / heat wave** — first forecast day max/min beyond
 *     a coarse threshold (≤0°C / ≥35°C).
 *
 * Honest scope: each nudge only renders when its data is genuinely
 * available. Dismissal is per-session (no localStorage — these are
 * meant to re-appear if the user returns later and the condition
 * still holds). Toasts auto-stack vertically bottom-right, above
 * the SOS FAB + assistant FAB.
 *
 * Installed for Phase 4 — Emotional UI (H2).
 */
'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Cloud,
  Sparkles,
  ThermometerSnowflake,
  ThermometerSun,
  X,
} from 'lucide-react';

export interface NudgeWeatherDay {
  readonly maxC: number;
  readonly minC: number;
  readonly precipPct: number | null;
}

export interface CompanionContext {
  /** Days until the trip's startsOn. null when unset / not upcoming. */
  readonly daysUntilStart: number | null;
  /** Day index within the trip (1-based) when on a current trip. */
  readonly dayProgressIdx: number | null;
  readonly dayProgressTotal: number | null;
  /** Today's plan completed/total when known. */
  readonly completedCount: number | null;
  readonly itemCount: number | null;
  /** First forecast day for the trip (today / tomorrow). */
  readonly firstForecastDay: NudgeWeatherDay | null;
  /** Trip title for friendlier copy. */
  readonly tripTitle: string | null;
  /** Trip id for deep-link targets. */
  readonly tripId: string | null;
}

type NudgeKey = 'deadline' | 'rain' | 'progress' | 'cold' | 'heat';
interface Nudge {
  readonly key: NudgeKey;
  readonly icon: typeof Sparkles;
  readonly tone: 'amber' | 'blue' | 'gold' | 'red';
  readonly title: string;
  readonly body: string;
}

const TONES: Readonly<Record<Nudge['tone'], string>> = {
  amber:
    'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 [&_svg]:text-amber-600',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200 [&_svg]:text-blue-600',
  gold: 'border-gold-600/30 bg-gold-500/10 text-gold-800 dark:text-gold-200 [&_svg]:text-gold-600',
  red: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200 [&_svg]:text-red-600',
};

function deriveNudges(ctx: CompanionContext): readonly Nudge[] {
  const out: Nudge[] = [];

  // Deadline (mirrors G5 — 7-day window).
  if (
    ctx.daysUntilStart !== null &&
    ctx.daysUntilStart >= 0 &&
    ctx.daysUntilStart <= 7 &&
    ctx.tripTitle
  ) {
    const when =
      ctx.daysUntilStart === 0
        ? 'today'
        : ctx.daysUntilStart === 1
          ? 'tomorrow'
          : `in ${ctx.daysUntilStart} days`;
    out.push({
      key: 'deadline',
      icon: Sparkles,
      tone: 'gold',
      title: `${ctx.tripTitle} starts ${when}`,
      body: 'Review your itinerary, pack-list, and any visa basics from the Local Safety card.',
    });
  }

  // Rainy day ahead.
  if (
    ctx.firstForecastDay &&
    ctx.firstForecastDay.precipPct !== null &&
    ctx.firstForecastDay.precipPct >= 60
  ) {
    out.push({
      key: 'rain',
      icon: Cloud,
      tone: 'blue',
      title: 'Rain likely today',
      body: `${ctx.firstForecastDay.precipPct}% chance — pack a poncho or shift outdoor plans.`,
    });
  }

  // Cold snap.
  if (ctx.firstForecastDay && ctx.firstForecastDay.minC <= 0) {
    out.push({
      key: 'cold',
      icon: ThermometerSnowflake,
      tone: 'blue',
      title: 'Freezing temperatures',
      body: `Low of ${Math.round(ctx.firstForecastDay.minC)}°C — bring proper layers.`,
    });
  }

  // Heat wave.
  if (ctx.firstForecastDay && ctx.firstForecastDay.maxC >= 35) {
    out.push({
      key: 'heat',
      icon: ThermometerSun,
      tone: 'red',
      title: 'Extreme heat today',
      body: `High of ${Math.round(ctx.firstForecastDay.maxC)}°C — hydrate, schedule indoor breaks.`,
    });
  }

  // Progress check — past 50% of trip with <25% of today's items.
  if (
    ctx.dayProgressIdx !== null &&
    ctx.dayProgressTotal !== null &&
    ctx.dayProgressTotal >= 2 &&
    ctx.itemCount !== null &&
    ctx.itemCount > 0 &&
    ctx.completedCount !== null
  ) {
    const tripFraction = ctx.dayProgressIdx / ctx.dayProgressTotal;
    const dayFraction = ctx.completedCount / ctx.itemCount;
    if (tripFraction >= 0.5 && dayFraction < 0.25) {
      out.push({
        key: 'progress',
        icon: AlertTriangle,
        tone: 'amber',
        title: 'Still time to make today count',
        body: `You've checked off ${ctx.completedCount}/${ctx.itemCount}. Open the trip to dive in.`,
      });
    }
  }

  return out;
}

interface Props {
  readonly ctx: CompanionContext;
}

export function CompanionNudges({ ctx }: Props) {
  const reduce = useReducedMotion();
  // Per-session dismissal. NOT localStorage — these nudges are
  // condition-driven; if the condition still holds next visit, they
  // should reappear.
  const [dismissed, setDismissed] = useState<ReadonlySet<NudgeKey>>(() => new Set());
  const nudges = useMemo(() => deriveNudges(ctx), [ctx]);
  const visible = nudges.filter((n) => !dismissed.has(n.key));
  if (visible.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-44 right-4 z-40 flex w-80 max-w-[88vw] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {visible.map((n) => {
          const Icon = n.icon;
          return (
            <motion.div
              key={n.key}
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs shadow-(--shadow-depth-2) backdrop-blur-sm ${TONES[n.tone]}`}
              role="status"
            >
              <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 opacity-90">{n.body}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDismissed((cur) => {
                    const next = new Set(cur);
                    next.add(n.key);
                    return next;
                  })
                }
                aria-label={`Dismiss ${n.title}`}
                className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
