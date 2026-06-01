/**
 * AE416 — pure helpers for the Pulse hold-to-talk gesture that opens
 * the Genie modal.
 *
 * Per docs/aether/02-surfaces.md §7 Pulse + §2 Genie: "Hold the Pulse.
 * The current surface dissolves into ~5000 particles that swirl into
 * the lower third." AE416 wires the gesture half — a hold beyond
 * `PULSE_HOLD_THRESHOLD_MS` opens the Genie modal; a tap < threshold
 * still fires the existing AE96 Pulse-open path so the FAB stays
 * reachable for quick prompts.
 *
 * Pure — no React, no DOM. The hook in `use-pulse-hold-to-talk.tsx`
 * wires pointer events around these helpers.
 */

/** Press duration (ms) past which we treat the press as a hold gesture
 *  and open Genie. Sub-threshold presses fall through to the existing
 *  AE96 Pulse-open click path. 500 ms is the iOS long-press default —
 *  long enough not to fire on quick taps, short enough not to feel
 *  laggy. */
export const PULSE_HOLD_THRESHOLD_MS = 500;

/** Hold-to-talk interaction lifecycle. Distinct from the recorder
 *  status etc. so each surface can drive its own state. */
export type PulseHoldStatus =
  | 'idle' // no pointer pressed
  | 'pressing' // pointer down, threshold not yet exceeded
  | 'holding' // threshold exceeded — about to open Genie on release
  | 'released'; // press released; status returns to idle next tick

/** Decide whether a completed press counts as a hold gesture. The
 *  caller subtracts press start from release time and passes the
 *  delta in ms. */
export function isHoldGesture(
  durationMs: number,
  threshold: number = PULSE_HOLD_THRESHOLD_MS,
): boolean {
  if (!Number.isFinite(durationMs)) return false;
  return durationMs >= threshold;
}

/** Decide the next status given the current one + the elapsed press
 *  duration. Pure: the hook calls this from setInterval / setTimeout
 *  so the FSM stays testable. */
export function nextHoldStatus(
  current: PulseHoldStatus,
  elapsedMs: number,
  threshold: number = PULSE_HOLD_THRESHOLD_MS,
): PulseHoldStatus {
  if (current === 'idle') return 'idle';
  if (current === 'released') return 'idle';
  if (current === 'pressing' && isHoldGesture(elapsedMs, threshold)) return 'holding';
  return current;
}

/** Outcome of releasing the pointer. Used by the caller to decide
 *  which downstream handler fires (tap → openPulse, hold → openGenie). */
export type PulseReleaseOutcome = 'tap' | 'hold' | 'cancel';

/** Decide what to do on pointer release given the status at release. */
export function pulseReleaseOutcome(
  status: PulseHoldStatus,
  durationMs: number,
  threshold: number = PULSE_HOLD_THRESHOLD_MS,
): PulseReleaseOutcome {
  if (status === 'idle') return 'cancel';
  if (status === 'holding') return 'hold';
  if (isHoldGesture(durationMs, threshold)) return 'hold';
  return 'tap';
}

/** Aria-live label for the hold gesture. Calling this from a
 *  `role=status` line gives screen-reader users the same affordance
 *  hint sighted users get from the glow. */
export function holdStatusLabel(status: PulseHoldStatus): string {
  switch (status) {
    case 'idle':
      return 'Pulse ready';
    case 'pressing':
      return 'Keep holding to talk to Genie';
    case 'holding':
      return 'Release to talk to Genie';
    case 'released':
      return 'Opening Genie';
  }
}
