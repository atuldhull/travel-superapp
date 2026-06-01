/**
 * AE493 — canvas-shared own behavioural spec for `pulse-hold-to-talk`.
 *
 * Pins the hold-vs-tap decision, the four-status lifecycle FSM, the
 * release-outcome router, and the aria-live label set so the Phase 4
 * native Pulse FAB can re-export the same gesture math.
 */
import {
  PULSE_HOLD_THRESHOLD_MS,
  holdStatusLabel,
  isHoldGesture,
  nextHoldStatus,
  pulseReleaseOutcome,
  type PulseHoldStatus,
} from '../src';

describe('AE493 — PULSE_HOLD_THRESHOLD_MS sanity', () => {
  it('matches the iOS long-press default range (300..700ms)', () => {
    expect(PULSE_HOLD_THRESHOLD_MS).toBeGreaterThanOrEqual(300);
    expect(PULSE_HOLD_THRESHOLD_MS).toBeLessThanOrEqual(700);
  });
});

describe('AE493 — isHoldGesture', () => {
  it('returns true at + above the default threshold', () => {
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS)).toBe(true);
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS + 1)).toBe(true);
    expect(isHoldGesture(2_000)).toBe(true);
  });
  it('returns false below the default threshold', () => {
    expect(isHoldGesture(0)).toBe(false);
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS - 1)).toBe(false);
    expect(isHoldGesture(100)).toBe(false);
  });
  it('respects a caller-supplied threshold', () => {
    expect(isHoldGesture(200, 100)).toBe(true);
    expect(isHoldGesture(200, 500)).toBe(false);
  });
  it('returns false for non-finite input (NaN + Infinity)', () => {
    expect(isHoldGesture(Number.NaN)).toBe(false);
    expect(isHoldGesture(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isHoldGesture(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

describe('AE493 — nextHoldStatus', () => {
  it('idle is sticky (no elapsed time can push it forward)', () => {
    expect(nextHoldStatus('idle', 0)).toBe('idle');
    expect(nextHoldStatus('idle', 10_000)).toBe('idle');
  });
  it('released collapses back to idle', () => {
    expect(nextHoldStatus('released', 0)).toBe('idle');
    expect(nextHoldStatus('released', 5_000)).toBe('idle');
  });
  it('pressing flips to holding once elapsed reaches threshold', () => {
    expect(nextHoldStatus('pressing', PULSE_HOLD_THRESHOLD_MS - 1)).toBe('pressing');
    expect(nextHoldStatus('pressing', PULSE_HOLD_THRESHOLD_MS)).toBe('holding');
    expect(nextHoldStatus('pressing', PULSE_HOLD_THRESHOLD_MS + 100)).toBe('holding');
  });
  it('holding is sticky (no demotion back to pressing)', () => {
    expect(nextHoldStatus('holding', 0)).toBe('holding');
    expect(nextHoldStatus('holding', 10_000)).toBe('holding');
  });
  it('honours a caller-supplied threshold', () => {
    expect(nextHoldStatus('pressing', 150, 100)).toBe('holding');
    expect(nextHoldStatus('pressing', 150, 200)).toBe('pressing');
  });
});

describe('AE493 — pulseReleaseOutcome', () => {
  it('idle release is a cancel (no FSM started)', () => {
    expect(pulseReleaseOutcome('idle', 0)).toBe('cancel');
    expect(pulseReleaseOutcome('idle', 10_000)).toBe('cancel');
  });
  it('holding release is always a hold outcome', () => {
    expect(pulseReleaseOutcome('holding', 0)).toBe('hold');
    expect(pulseReleaseOutcome('holding', 100)).toBe('hold');
  });
  it('pressing release becomes a hold once duration crosses threshold', () => {
    expect(pulseReleaseOutcome('pressing', PULSE_HOLD_THRESHOLD_MS - 1)).toBe('tap');
    expect(pulseReleaseOutcome('pressing', PULSE_HOLD_THRESHOLD_MS)).toBe('hold');
    expect(pulseReleaseOutcome('pressing', PULSE_HOLD_THRESHOLD_MS + 100)).toBe('hold');
  });
  it('released status passes through the duration check', () => {
    expect(pulseReleaseOutcome('released', 50)).toBe('tap');
    expect(pulseReleaseOutcome('released', PULSE_HOLD_THRESHOLD_MS)).toBe('hold');
  });
  it('honours a caller-supplied threshold', () => {
    expect(pulseReleaseOutcome('pressing', 200, 100)).toBe('hold');
    expect(pulseReleaseOutcome('pressing', 200, 500)).toBe('tap');
  });
});

describe('AE493 — holdStatusLabel', () => {
  const ALL: PulseHoldStatus[] = ['idle', 'pressing', 'holding', 'released'];
  it('returns a non-empty label for every status', () => {
    for (const s of ALL) {
      expect(holdStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
  it('idle reads as a ready state', () => {
    expect(holdStatusLabel('idle')).toMatch(/ready/i);
  });
  it('pressing copy nudges the user to keep holding', () => {
    expect(holdStatusLabel('pressing')).toMatch(/keep.*hold/i);
  });
  it('holding copy invites release', () => {
    expect(holdStatusLabel('holding')).toMatch(/release/i);
  });
  it('released copy announces Genie is opening', () => {
    expect(holdStatusLabel('released')).toMatch(/open/i);
  });
});

describe('AE493 — full press lifecycle', () => {
  it('walks idle → pressing (tap) → idle without crossing threshold', () => {
    let s: PulseHoldStatus = 'pressing';
    s = nextHoldStatus(s, PULSE_HOLD_THRESHOLD_MS - 1);
    expect(s).toBe('pressing');
    expect(pulseReleaseOutcome(s, PULSE_HOLD_THRESHOLD_MS - 1)).toBe('tap');
  });
  it('walks pressing → holding → release(hold)', () => {
    let s: PulseHoldStatus = 'pressing';
    s = nextHoldStatus(s, PULSE_HOLD_THRESHOLD_MS);
    expect(s).toBe('holding');
    expect(pulseReleaseOutcome(s, PULSE_HOLD_THRESHOLD_MS + 100)).toBe('hold');
  });
});
