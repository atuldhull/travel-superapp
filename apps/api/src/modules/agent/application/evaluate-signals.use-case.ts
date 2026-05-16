/**
 * POST.2A.3 — the deterministic core of the agent loop.
 *
 * PURE function: (previous snapshot, current snapshot, threshold) →
 * PlanDiff[]. No I/O, no clock, no LLM (Track A design stance §5/§6).
 * The scheduler does the I/O (pull snapshots, persist, lock); this
 * just decides whether a change is *material* and debounces repeats
 * so the agent doesn't re-propose the same thing every tick.
 *
 * Snapshot.data is provider-neutral. The two rules today:
 *   - weather: `maxPrecipProbabilityPercent` (0..100) vs a 0..1
 *     threshold → a 'move' diff for the worst day.
 *   - flight:  `delayed` boolean → a 'move' diff.
 * Sub-threshold, or "already over threshold last tick", → [].
 *
 * Installed by prompt [POST.2A.3].
 */
import { Injectable } from '@nestjs/common';
import type { PlanDiff } from '../domain/plan-diff.vo';
import type { SignalSnapshot } from './ports/signal-source.port';

export interface EvaluateSignalsInput {
  /** Last snapshot the agent saw for this watch+kind, or null. */
  readonly previous: SignalSnapshot | null;
  readonly current: SignalSnapshot;
  /** Materiality gate, 0..1 (TripWatch.thresholds[kind]). */
  readonly threshold: number;
}

function precip(snap: SignalSnapshot | null): number {
  if (!snap) return -1;
  const v = snap.data['maxPrecipProbabilityPercent'];
  return typeof v === 'number' ? v / 100 : -1;
}

function delayed(snap: SignalSnapshot | null): boolean {
  return snap?.data['delayed'] === true;
}

@Injectable()
export class EvaluateSignalsUseCase {
  /** Pure + synchronous. Same inputs → same output, every time. */
  execute(input: EvaluateSignalsInput): readonly PlanDiff[] {
    const { previous, current, threshold } = input;

    if (current.kind === 'weather') {
      const now = precip(current);
      const before = precip(previous);
      // Material only when we cross the gate AND weren't already over
      // it last tick (debounce — no repeat proposals every interval).
      if (now >= threshold && before < threshold) {
        const worstDay = current.data['worstDay'];
        const stopId = typeof worstDay === 'string' ? worstDay : 'weather';
        return [
          {
            op: 'move',
            stopId,
            reason: `rain ${Math.round(now * 100)}% on ${stopId}`,
          },
        ];
      }
      return [];
    }

    if (current.kind === 'flight') {
      if (delayed(current) && !delayed(previous)) {
        return [{ op: 'move', stopId: 'flight', reason: 'flight delay detected' }];
      }
      return [];
    }

    // geofence + anything else: no rule yet (lands in a later prompt).
    return [];
  }
}
