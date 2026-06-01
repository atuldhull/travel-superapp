/** Vitest specs for AE409 Lumen pinch helpers. */
import { describe, expect, it } from 'vitest';
import {
  PINCH_DELTA_THRESHOLD,
  nearestPlaneToCenter,
  nextFocusForPinch,
  wheelToPinchIntent,
} from '../../src/components/aether/phase2/lumen-pinch';
import type { LumenPlaneLayout } from '../../src/components/aether/phase2/lumen-cloud';

function plane(id: string, position: [number, number, number]): LumenPlaneLayout {
  return { id, position, size: 1.6, url: null };
}

describe('PINCH_DELTA_THRESHOLD (pure)', () => {
  it('is positive (we need a deliberate gesture)', () => {
    expect(PINCH_DELTA_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('wheelToPinchIntent (pure)', () => {
  it('null when ctrlKey is false (regular scroll)', () => {
    expect(wheelToPinchIntent({ deltaY: -10, ctrlKey: false })).toBeNull();
    expect(wheelToPinchIntent({ deltaY: 10, ctrlKey: false })).toBeNull();
    expect(wheelToPinchIntent({ deltaY: 0, ctrlKey: false })).toBeNull();
  });

  it('negative deltaY with ctrlKey → "in" (zoom in / fingers spread)', () => {
    expect(wheelToPinchIntent({ deltaY: -10, ctrlKey: true })).toBe('in');
  });

  it('positive deltaY with ctrlKey → "out" (zoom out / fingers together)', () => {
    expect(wheelToPinchIntent({ deltaY: 10, ctrlKey: true })).toBe('out');
  });

  it('sub-threshold deltaY → null (ignore noise)', () => {
    expect(wheelToPinchIntent({ deltaY: 0.5, ctrlKey: true })).toBeNull();
    expect(wheelToPinchIntent({ deltaY: -0.5, ctrlKey: true })).toBeNull();
    expect(wheelToPinchIntent({ deltaY: 0, ctrlKey: true })).toBeNull();
  });

  it('exactly at threshold → null (strict >)', () => {
    expect(wheelToPinchIntent({ deltaY: PINCH_DELTA_THRESHOLD, ctrlKey: true })).toBeNull();
    expect(wheelToPinchIntent({ deltaY: -PINCH_DELTA_THRESHOLD, ctrlKey: true })).toBeNull();
  });

  it('just past threshold → intent fires', () => {
    expect(wheelToPinchIntent({ deltaY: PINCH_DELTA_THRESHOLD + 0.01, ctrlKey: true })).toBe('out');
    expect(wheelToPinchIntent({ deltaY: -PINCH_DELTA_THRESHOLD - 0.01, ctrlKey: true })).toBe('in');
  });
});

describe('nearestPlaneToCenter (pure)', () => {
  it('empty planes → null', () => {
    expect(nearestPlaneToCenter([])).toBeNull();
  });

  it('single plane → its id', () => {
    expect(nearestPlaneToCenter([plane('only', [5, 5, 0])])).toBe('only');
  });

  it('picks the plane closest to (0, 0) by default', () => {
    const planes = [plane('far', [10, 10, 0]), plane('mid', [3, 2, 0]), plane('near', [1, 0, 0])];
    expect(nearestPlaneToCenter(planes)).toBe('near');
  });

  it('honours custom centre coords', () => {
    const planes = [plane('a', [0, 0, 0]), plane('b', [5, 5, 0])];
    expect(nearestPlaneToCenter(planes, 6, 6)).toBe('b');
  });

  it('ignores Z when computing distance', () => {
    const planes = [plane('flat', [3, 0, 0]), plane('deep', [1, 0, 100])];
    expect(nearestPlaneToCenter(planes)).toBe('deep');
  });

  it('ties resolve to the first plane encountered', () => {
    const planes = [plane('first', [3, 4, 0]), plane('second', [3, 4, 0])];
    expect(nearestPlaneToCenter(planes)).toBe('first');
  });
});

describe('nextFocusForPinch (pure)', () => {
  const planes = [plane('a', [-3, 0, 0]), plane('center', [0, 0, 0]), plane('b', [3, 0, 0])];

  it('null intent → undefined (no change)', () => {
    expect(nextFocusForPinch(null, null, planes)).toBeUndefined();
    expect(nextFocusForPinch(null, 'a', planes)).toBeUndefined();
  });

  it('in + null focus → nearest-to-centre id', () => {
    expect(nextFocusForPinch('in', null, planes)).toBe('center');
  });

  it('in + null focus + empty planes → null (no target)', () => {
    expect(nextFocusForPinch('in', null, [])).toBeNull();
  });

  it('in + already focused → undefined (no further zoom)', () => {
    expect(nextFocusForPinch('in', 'a', planes)).toBeUndefined();
  });

  it('out + null focus → undefined (already at widest)', () => {
    expect(nextFocusForPinch('out', null, planes)).toBeUndefined();
  });

  it('out + focused → null (clear focus)', () => {
    expect(nextFocusForPinch('out', 'a', planes)).toBeNull();
  });

  it('out works regardless of the focused id', () => {
    expect(nextFocusForPinch('out', 'center', planes)).toBeNull();
    expect(nextFocusForPinch('out', 'b', planes)).toBeNull();
  });
});
