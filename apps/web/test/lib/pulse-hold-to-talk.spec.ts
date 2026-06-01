/** Vitest specs for AE416 Pulse hold-to-talk helpers. */
import { describe, expect, it } from 'vitest';
import {
  PULSE_HOLD_THRESHOLD_MS,
  holdStatusLabel,
  isHoldGesture,
  nextHoldStatus,
  pulseReleaseOutcome,
  type PulseHoldStatus,
} from '../../src/components/aether/phase2/pulse-hold-to-talk';

describe('PULSE_HOLD_THRESHOLD_MS (pure)', () => {
  it('is a deliberate but not-laggy duration (250-1000 ms)', () => {
    expect(PULSE_HOLD_THRESHOLD_MS).toBeGreaterThanOrEqual(250);
    expect(PULSE_HOLD_THRESHOLD_MS).toBeLessThanOrEqual(1000);
  });
});

describe('isHoldGesture (pure)', () => {
  it('below threshold → false', () => {
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS - 1)).toBe(false);
    expect(isHoldGesture(0)).toBe(false);
  });
  it('at threshold (inclusive) → true', () => {
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS)).toBe(true);
  });
  it('past threshold → true', () => {
    expect(isHoldGesture(PULSE_HOLD_THRESHOLD_MS * 2)).toBe(true);
  });
  it('NaN / Infinity → false (treated as no usable duration)', () => {
    expect(isHoldGesture(Number.NaN)).toBe(false);
    expect(isHoldGesture(Number.POSITIVE_INFINITY)).toBe(false);
  });
  it('honours custom threshold', () => {
    expect(isHoldGesture(120, 100)).toBe(true);
    expect(isHoldGesture(80, 100)).toBe(false);
  });
});

describe('nextHoldStatus (pure)', () => {
  it('idle → idle (no state churn without a press)', () => {
    expect(nextHoldStatus('idle', 999)).toBe('idle');
  });
  it('released → idle (next tick reset)', () => {
    expect(nextHoldStatus('released', 100)).toBe('idle');
  });
  it('pressing below threshold stays pressing', () => {
    expect(nextHoldStatus('pressing', 100)).toBe('pressing');
  });
  it('pressing past threshold → holding', () => {
    expect(nextHoldStatus('pressing', PULSE_HOLD_THRESHOLD_MS + 1)).toBe('holding');
  });
  it('already holding stays holding', () => {
    expect(nextHoldStatus('holding', 5_000)).toBe('holding');
  });
  it('honours custom threshold', () => {
    expect(nextHoldStatus('pressing', 150, 100)).toBe('holding');
    expect(nextHoldStatus('pressing', 50, 100)).toBe('pressing');
  });
});

describe('pulseReleaseOutcome (pure)', () => {
  it('idle release → cancel (race / no press)', () => {
    expect(pulseReleaseOutcome('idle', 999)).toBe('cancel');
  });
  it('holding release → hold (always)', () => {
    expect(pulseReleaseOutcome('holding', 0)).toBe('hold');
  });
  it("pressing release past threshold → hold (race: hook hadn't flipped yet)", () => {
    expect(pulseReleaseOutcome('pressing', PULSE_HOLD_THRESHOLD_MS + 1)).toBe('hold');
  });
  it('pressing release sub-threshold → tap', () => {
    expect(pulseReleaseOutcome('pressing', 100)).toBe('tap');
  });
  it('released state → tap (status flips after release)', () => {
    expect(pulseReleaseOutcome('released', 100)).toBe('tap');
  });
  it('honours custom threshold', () => {
    expect(pulseReleaseOutcome('pressing', 150, 100)).toBe('hold');
    expect(pulseReleaseOutcome('pressing', 50, 100)).toBe('tap');
  });
});

describe('holdStatusLabel (pure)', () => {
  it('returns distinct copy per state', () => {
    const states: PulseHoldStatus[] = ['idle', 'pressing', 'holding', 'released'];
    const labels = new Set(states.map((s) => holdStatusLabel(s)));
    expect(labels.size).toBe(states.length);
  });
  it('idle label reads as default state', () => {
    expect(holdStatusLabel('idle').toLowerCase()).toContain('ready');
  });
  it('holding label tells the user what release will do', () => {
    expect(holdStatusLabel('holding').toLowerCase()).toContain('genie');
  });
});
