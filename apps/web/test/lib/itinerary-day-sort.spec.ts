/**
 * Vitest specs for AE301 sortItineraryDays.
 */
import { describe, expect, it } from 'vitest';
import { sortItineraryDays } from '../../src/components/aether/journey/itinerary-day-sort';

describe('sortItineraryDays', () => {
  it('empty → []', () => {
    expect(sortItineraryDays([])).toEqual([]);
  });

  it('already-sorted passes through unchanged', () => {
    const days = [
      { id: 'a', date: '2026-06-01' },
      { id: 'b', date: '2026-06-02' },
      { id: 'c', date: '2026-06-03' },
    ];
    expect(sortItineraryDays(days).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('reverses a backwards input', () => {
    const days = [
      { id: 'c', date: '2026-06-03' },
      { id: 'a', date: '2026-06-01' },
      { id: 'b', date: '2026-06-02' },
    ];
    expect(sortItineraryDays(days).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('null-dated days sort to the end (preserving input order)', () => {
    const days = [
      { id: 'd', date: null },
      { id: 'a', date: '2026-06-01' },
      { id: 'e', date: null },
      { id: 'b', date: '2026-06-02' },
    ];
    expect(sortItineraryDays(days).map((d) => d.id)).toEqual(['a', 'b', 'd', 'e']);
  });

  it('does NOT mutate the input', () => {
    const days = [
      { id: 'c', date: '2026-06-03' },
      { id: 'a', date: '2026-06-01' },
    ];
    const before = days.slice();
    sortItineraryDays(days);
    expect(days).toEqual(before);
  });

  it('ties resolve to original input order', () => {
    const days = [
      { id: 'a', date: '2026-06-01' },
      { id: 'b', date: '2026-06-01' },
      { id: 'c', date: '2026-06-01' },
    ];
    expect(sortItineraryDays(days).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('unparseable date treated as null (sorts to end)', () => {
    const days = [
      { id: 'bad', date: 'garbage' },
      { id: 'a', date: '2026-06-01' },
    ];
    expect(sortItineraryDays(days).map((d) => d.id)).toEqual(['a', 'bad']);
  });
});
