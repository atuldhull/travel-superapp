/**
 * AE494 — canvas-shared own behavioural spec for `lumen-pinch`.
 *
 * Pins the wheel-to-intent decision (ctrlKey gate + deltaY sign +
 * sub-1px noise threshold), nearestPlaneToCenter's geometric tie
 * resolution + empty-list null, and nextFocusForPinch's 6-arm
 * transition table.
 */
import {
  PINCH_DELTA_THRESHOLD,
  nearestPlaneToCenter,
  nextFocusForPinch,
  wheelToPinchIntent,
} from '../src';
import type { LumenPlaneLayout } from '../src';

const PLANE = (id: string, x: number, y: number): LumenPlaneLayout => ({
  id,
  position: [x, y, 0],
  size: 1,
  url: null,
});

describe('AE494 — PINCH_DELTA_THRESHOLD sanity', () => {
  it('is a positive sub-10px noise floor', () => {
    expect(PINCH_DELTA_THRESHOLD).toBeGreaterThan(0);
    expect(PINCH_DELTA_THRESHOLD).toBeLessThan(10);
  });
});

describe('AE494 — wheelToPinchIntent', () => {
  it('returns null when ctrlKey is false (regular scroll, not pinch)', () => {
    expect(wheelToPinchIntent({ deltaY: -100, ctrlKey: false })).toBe(null);
    expect(wheelToPinchIntent({ deltaY: 100, ctrlKey: false })).toBe(null);
  });
  it('returns "in" when ctrlKey + deltaY is sufficiently negative', () => {
    expect(wheelToPinchIntent({ deltaY: -10, ctrlKey: true })).toBe('in');
    expect(wheelToPinchIntent({ deltaY: -PINCH_DELTA_THRESHOLD - 0.5, ctrlKey: true })).toBe('in');
  });
  it('returns "out" when ctrlKey + deltaY is sufficiently positive', () => {
    expect(wheelToPinchIntent({ deltaY: 10, ctrlKey: true })).toBe('out');
    expect(wheelToPinchIntent({ deltaY: PINCH_DELTA_THRESHOLD + 0.5, ctrlKey: true })).toBe('out');
  });
  it('returns null for sub-threshold noise even with ctrlKey', () => {
    expect(wheelToPinchIntent({ deltaY: 0, ctrlKey: true })).toBe(null);
    expect(wheelToPinchIntent({ deltaY: 0.5, ctrlKey: true })).toBe(null);
    expect(wheelToPinchIntent({ deltaY: -0.5, ctrlKey: true })).toBe(null);
    expect(wheelToPinchIntent({ deltaY: PINCH_DELTA_THRESHOLD, ctrlKey: true })).toBe(null);
    expect(wheelToPinchIntent({ deltaY: -PINCH_DELTA_THRESHOLD, ctrlKey: true })).toBe(null);
  });
});

describe('AE494 — nearestPlaneToCenter', () => {
  it('returns null for an empty list', () => {
    expect(nearestPlaneToCenter([])).toBe(null);
  });
  it('returns the only plane in a singleton list regardless of position', () => {
    expect(nearestPlaneToCenter([PLANE('only', 99, -42)])).toBe('only');
  });
  it('picks the closest plane to the origin by default', () => {
    const planes = [PLANE('far', 10, 10), PLANE('near', 1, 1), PLANE('mid', 5, 5)];
    expect(nearestPlaneToCenter(planes)).toBe('near');
  });
  it('respects a caller-supplied centre point', () => {
    const planes = [PLANE('a', 0, 0), PLANE('b', 10, 10)];
    expect(nearestPlaneToCenter(planes, 9, 9)).toBe('b');
    expect(nearestPlaneToCenter(planes, 1, 1)).toBe('a');
  });
  it('returns the first plane on an exact distance tie', () => {
    const planes = [PLANE('first', 1, 0), PLANE('second', -1, 0)];
    expect(nearestPlaneToCenter(planes)).toBe('first');
  });
});

describe('AE494 — nextFocusForPinch transition table', () => {
  const planes = [PLANE('a', 0, 0), PLANE('b', 5, 5)];

  it('intent=null is always a no-op (undefined)', () => {
    expect(nextFocusForPinch(null, null, planes)).toBeUndefined();
    expect(nextFocusForPinch(null, 'a', planes)).toBeUndefined();
  });
  it('intent=in with no focus enters the nearest plane', () => {
    expect(nextFocusForPinch('in', null, planes)).toBe('a');
  });
  it('intent=in with a focus already set is a no-op (already zoomed in)', () => {
    expect(nextFocusForPinch('in', 'a', planes)).toBeUndefined();
  });
  it('intent=out with no focus is a no-op (already at widest)', () => {
    expect(nextFocusForPinch('out', null, planes)).toBeUndefined();
  });
  it('intent=out with a focus clears the focus (null)', () => {
    expect(nextFocusForPinch('out', 'a', planes)).toBe(null);
  });
  it('intent=in with no focus + empty planes returns null (no nearest)', () => {
    expect(nextFocusForPinch('in', null, [])).toBe(null);
  });
});
