/**
 * Vitest specs for AE256 findFirstItineraryDate.
 */
import { describe, expect, it } from 'vitest';
import { findFirstItineraryDate } from '../../src/components/aether/journey/find-first-itinerary-date';

describe('findFirstItineraryDate', () => {
  it('prefers trip.startsOn over everything', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: '2026-06-01',
        tripCreatedAt: '2026-05-30',
        itineraryDays: [{ date: '2026-05-15' }, { date: '2026-05-10' }],
      }),
    ).toBe('2026-06-01');
  });

  it('falls back to earliest itinerary date when startsOn missing', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: '2026-05-30',
        itineraryDays: [{ date: '2026-06-05' }, { date: '2026-06-01' }, { date: '2026-06-10' }],
      }),
    ).toBe('2026-06-01');
  });

  it('out-of-order itinerary days: still picks earliest', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: '2026-01-01',
        itineraryDays: [{ date: '2026-06-10' }, { date: '2026-06-08' }, { date: '2026-06-09' }],
      }),
    ).toBe('2026-06-08');
  });

  it('falls back to createdAt when no startsOn and itinerary empty', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: '2026-05-30',
        itineraryDays: [],
      }),
    ).toBe('2026-05-30');
  });

  it('falls back to createdAt when itinerary only has null dates', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: '2026-05-30',
        itineraryDays: [{ date: null }, { date: null }],
      }),
    ).toBe('2026-05-30');
  });

  it('returns null when everything is missing', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: null,
        itineraryDays: [],
      }),
    ).toBeNull();
  });

  it('unparseable itinerary dates are skipped', () => {
    expect(
      findFirstItineraryDate({
        tripStartsOn: null,
        tripCreatedAt: '2026-05-30',
        itineraryDays: [{ date: 'bogus' }, { date: '2026-06-01' }, { date: 'also-bogus' }],
      }),
    ).toBe('2026-06-01');
  });
});
