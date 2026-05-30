/**
 * Vitest specs for AE239 itineraryDayLabel.
 */
import { describe, expect, it } from 'vitest';
import { itineraryDayLabel } from '../../src/components/aether/journey/itinerary-day-num';

describe('itineraryDayLabel', () => {
  it('index 0 → Day 1', () => {
    expect(itineraryDayLabel(0)).toEqual({
      num: 1,
      label: 'Day 1',
      anchorId: 'day-1',
    });
  });

  it('index 4 → Day 5', () => {
    expect(itineraryDayLabel(4)).toEqual({
      num: 5,
      label: 'Day 5',
      anchorId: 'day-5',
    });
  });

  it('tripId prefixes the anchor id', () => {
    expect(itineraryDayLabel(0, 'trip-xyz').anchorId).toBe('day-trip-xyz-1');
  });

  it('null tripId falls back to numeric anchor only', () => {
    expect(itineraryDayLabel(2, null).anchorId).toBe('day-3');
  });

  it('empty-string tripId is treated as missing', () => {
    expect(itineraryDayLabel(0, '').anchorId).toBe('day-1');
  });

  it('label is always "Day <num>"', () => {
    for (let i = 0; i < 10; i++) {
      expect(itineraryDayLabel(i).label).toBe(`Day ${i + 1}`);
    }
  });

  it('anchor id always starts with "day-"', () => {
    expect(itineraryDayLabel(0, 'abc').anchorId.startsWith('day-')).toBe(true);
    expect(itineraryDayLabel(99).anchorId.startsWith('day-')).toBe(true);
  });
});
