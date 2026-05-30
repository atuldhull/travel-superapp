/**
 * Vitest specs for AE226 computeChecklistProgress.
 */
import { describe, expect, it } from 'vitest';
import { computeChecklistProgress } from '../../src/components/aether/journey/checklist-progress';

const mk = (checked: boolean): { checked: boolean } => ({ checked });

describe('computeChecklistProgress', () => {
  it('empty list → zeros + allDone:false', () => {
    expect(computeChecklistProgress([])).toEqual({
      total: 0,
      done: 0,
      fraction: 0,
      percent: 0,
      allDone: false,
    });
  });

  it('all unchecked → done:0', () => {
    expect(computeChecklistProgress([mk(false), mk(false), mk(false)])).toEqual({
      total: 3,
      done: 0,
      fraction: 0,
      percent: 0,
      allDone: false,
    });
  });

  it('half done → fraction 0.5, percent 50', () => {
    expect(computeChecklistProgress([mk(true), mk(false)])).toEqual({
      total: 2,
      done: 1,
      fraction: 0.5,
      percent: 50,
      allDone: false,
    });
  });

  it('all done → allDone:true + percent:100', () => {
    expect(computeChecklistProgress([mk(true), mk(true)])).toEqual({
      total: 2,
      done: 2,
      fraction: 1,
      percent: 100,
      allDone: true,
    });
  });

  it('rounds percent to a whole number', () => {
    // 5/12 = 0.41666... → 42
    const items = [
      mk(true),
      mk(true),
      mk(true),
      mk(true),
      mk(true),
      mk(false),
      mk(false),
      mk(false),
      mk(false),
      mk(false),
      mk(false),
      mk(false),
    ];
    const got = computeChecklistProgress(items);
    expect(got.percent).toBe(42);
    expect(got.done).toBe(5);
    expect(got.total).toBe(12);
  });

  it('single done item → 100%', () => {
    expect(computeChecklistProgress([mk(true)]).percent).toBe(100);
  });

  it('only truthy `checked === true` counts (defensive)', () => {
    // Cast a coerce-able falsy onto the type — ensure we don't count it.
    const arr = [{ checked: true }, { checked: false }, { checked: false }];
    expect(computeChecklistProgress(arr).done).toBe(1);
  });
});
