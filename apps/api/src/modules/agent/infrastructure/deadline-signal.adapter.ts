/**
 * Phase 3 (G5) — Trip-start-approaching deadline signal.
 *
 * Pure (no network, no DB): derives `daysUntilStart` from the
 * optional `tripStartsOnIso` on the query and reports `changed:
 * true` when the trip is within a 7-day reminder window (and
 * hasn't already started).
 *
 * Honest scope:
 *   • No tripStartsOnIso → `{ changed: false }`. The signal is
 *     opt-in via the query, not via env.
 *   • Past start (daysUntilStart < 0) → not changed. The
 *     watch-cycle ends the trip via a different path
 *     (`outcome: 'closed'`).
 *   • Within the 7-day reminder window → `{ changed: true,
 *     daysUntilStart, windowDays }`. The evaluator can decide
 *     whether to bother the user.
 *
 * Subscribing a watch to `'deadline'` stays opt-in. This adapter
 * just makes the kind addressable from the CompositeSignalSource.
 */
import { Injectable } from '@nestjs/common';
import type {
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';

const REMINDER_WINDOW_DAYS = 7;

@Injectable()
export class DeadlineSignalAdapter implements SignalSource {
  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    const observedAt = new Date();
    const iso = query.tripStartsOnIso;
    if (!iso) {
      return {
        kind: 'deadline',
        observedAt,
        data: { changed: false, reason: 'no-startsOn' },
      };
    }
    const target = new Date(iso).getTime();
    if (!Number.isFinite(target)) {
      return {
        kind: 'deadline',
        observedAt,
        data: { changed: false, reason: 'invalid-iso' },
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetMidnight = new Date(target);
    targetMidnight.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.round((targetMidnight.getTime() - today.getTime()) / 86_400_000);
    if (daysUntilStart < 0) {
      return {
        kind: 'deadline',
        observedAt,
        data: { changed: false, daysUntilStart, reason: 'past' },
      };
    }
    if (daysUntilStart > REMINDER_WINDOW_DAYS) {
      return {
        kind: 'deadline',
        observedAt,
        data: { changed: false, daysUntilStart, windowDays: REMINDER_WINDOW_DAYS },
      };
    }
    return {
      kind: 'deadline',
      observedAt,
      data: { changed: true, daysUntilStart, windowDays: REMINDER_WINDOW_DAYS },
    };
  }
}
