'use client';

/**
 * AE416 — `usePulseHoldToTalk()` hook.
 *
 * Wires pointer events to the AE416 pure helpers so a sub-threshold
 * tap on the Pulse overlay falls through to the existing AE96 Pulse
 * open path while a deliberate hold opens the Genie modal.
 *
 * Returns the pointer handlers + the live hold status (so the overlay
 * can render a visual cue while the user is holding).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PULSE_HOLD_THRESHOLD_MS,
  nextHoldStatus,
  pulseReleaseOutcome,
  type PulseHoldStatus,
} from './pulse-hold-to-talk';

export interface PulseHoldHandlers {
  readonly status: PulseHoldStatus;
  onPointerDown(): void;
  onPointerUp(): void;
  onPointerLeave(): void;
  onPointerCancel(): void;
}

export interface UsePulseHoldOptions {
  /** Fires on a tap (sub-threshold release). Typically the AE96 Pulse
   *  open path. */
  onTap?: () => void;
  /** Fires on a hold release (> threshold). Typically opens the Genie
   *  modal. */
  onHold?: () => void;
  /** Threshold in ms; tests can shorten this. */
  thresholdMs?: number;
}

export function usePulseHoldToTalk(options: UsePulseHoldOptions = {}): PulseHoldHandlers {
  const { onTap, onHold, thresholdMs = PULSE_HOLD_THRESHOLD_MS } = options;
  const [status, setStatus] = useState<PulseHoldStatus>('idle');
  const startedAtRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((): void => {
    startedAtRef.current = Date.now();
    setStatus('pressing');
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setStatus((s) => nextHoldStatus(s, thresholdMs, thresholdMs));
    }, thresholdMs);
  }, [clearHoldTimer, thresholdMs]);

  const finish = useCallback(
    (outcomeOverride?: 'cancel'): void => {
      clearHoldTimer();
      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      const elapsed = startedAt === null ? 0 : Date.now() - startedAt;
      setStatus((prev) => {
        const outcome = outcomeOverride ?? pulseReleaseOutcome(prev, elapsed, thresholdMs);
        if (outcome === 'tap') onTap?.();
        else if (outcome === 'hold') onHold?.();
        return 'idle';
      });
    },
    [clearHoldTimer, onHold, onTap, thresholdMs],
  );

  const onPointerUp = useCallback((): void => finish(), [finish]);
  const onPointerLeave = useCallback((): void => finish('cancel'), [finish]);
  const onPointerCancel = useCallback((): void => finish('cancel'), [finish]);

  // Unmount safety: cancel any pending hold timer.
  useEffect(() => {
    return clearHoldTimer;
  }, [clearHoldTimer]);

  return { status, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel };
}
