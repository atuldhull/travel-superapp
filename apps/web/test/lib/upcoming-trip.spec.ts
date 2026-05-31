/** Vitest specs for AE393 upcoming-trip helpers. */
import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  nowCardPersonalised,
  pickUpcomingTrip,
  type UpcomingTripLike,
} from '../../src/components/aether/phase1/upcoming-trip';

// Construct with local-time fields so `getHours()` returns 10 regardless
// of the host machine's timezone — keeps "morning band" deterministic.
const NOW = new Date(2026, 5, 15, 10, 0, 0);

function trip(
  id: string,
  startsOn: string | null,
  overrides: Partial<UpcomingTripLike> = {},
): UpcomingTripLike {
  return {
    id,
    title: `Trip ${id}`,
    startsOn,
    endsOn: null,
    status: 'active',
    archivedAt: null,
    ...overrides,
  };
}

describe('daysUntil (pure)', () => {
  it('returns 0 for same UTC day', () => {
    expect(daysUntil('2026-06-15T23:00:00Z', NOW)).toBe(0);
  });
  it('returns positive integer for future', () => {
    expect(daysUntil('2026-06-20T10:00:00Z', NOW)).toBe(5);
  });
  it('returns negative integer for past', () => {
    expect(daysUntil('2026-06-10T10:00:00Z', NOW)).toBe(-5);
  });
  it('returns Infinity on null / undefined / empty', () => {
    expect(daysUntil(null, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(daysUntil(undefined, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(daysUntil('', NOW)).toBe(Number.POSITIVE_INFINITY);
  });
  it('returns Infinity on invalid date strings', () => {
    expect(daysUntil('not a date', NOW)).toBe(Number.POSITIVE_INFINITY);
  });
  it('accepts a Date input', () => {
    expect(daysUntil(new Date('2026-06-18T10:00:00Z'), NOW)).toBe(3);
  });
});

describe('pickUpcomingTrip (pure)', () => {
  it('returns null on empty array', () => {
    expect(pickUpcomingTrip([], NOW)).toBeNull();
  });

  it('picks the soonest-future trip', () => {
    const trips = [
      trip('a', '2026-07-01T10:00:00Z'),
      trip('b', '2026-06-20T10:00:00Z'),
      trip('c', '2026-08-01T10:00:00Z'),
    ];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('b');
  });

  it('skips trips with past startsOn', () => {
    const trips = [trip('past', '2026-05-01T10:00:00Z'), trip('future', '2026-07-01T10:00:00Z')];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('future');
  });

  it('skips archived trips', () => {
    const trips = [
      trip('archived', '2026-06-20T10:00:00Z', { archivedAt: '2026-06-10T10:00:00Z' }),
      trip('live', '2026-07-01T10:00:00Z'),
    ];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('live');
  });

  it('skips trips with null / empty startsOn', () => {
    const trips = [trip('null', null), trip('future', '2026-07-01T10:00:00Z')];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('future');
  });

  it('tie-breaks by id (alphabetical) when same day', () => {
    const trips = [trip('zzz', '2026-06-20T10:00:00Z'), trip('aaa', '2026-06-20T10:00:00Z')];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('aaa');
  });

  it('returns the trip starting today (d=0)', () => {
    const trips = [trip('today', '2026-06-15T23:00:00Z')];
    expect(pickUpcomingTrip(trips, NOW)?.id).toBe('today');
  });

  it('returns null when only past + archived + null-startsOn trips', () => {
    const trips = [
      trip('past', '2026-05-01T10:00:00Z'),
      trip('archived', '2026-07-01T10:00:00Z', { archivedAt: '2026-06-01T10:00:00Z' }),
      trip('null', null),
    ];
    expect(pickUpcomingTrip(trips, NOW)).toBeNull();
  });
});

describe('nowCardPersonalised (pure)', () => {
  it('falls back to time-of-day when no trip', () => {
    const out = nowCardPersonalised(NOW, null);
    // NOW = 10:00 UTC = morning band (10am local for UTC-rendered tests)
    expect(out.headline).toBe('Morning');
    expect(out.verb).toBe('Plan');
  });

  it('falls back to baseline for far-out trips (>30 days)', () => {
    const farTrip = trip('far', '2026-08-01T10:00:00Z');
    const out = nowCardPersonalised(NOW, farTrip);
    expect(out.headline).toBe('Morning');
  });

  it('"Trip day" headline when d <= 0', () => {
    const today = trip('today', '2026-06-15T23:00:00Z', { title: 'Leh sprint' });
    const out = nowCardPersonalised(NOW, today);
    expect(out.headline).toBe('Trip day');
    expect(out.suggestion).toBe('Leh sprint starts today.');
    expect(out.verb).toBe('Open');
  });

  it('"<N> day(s) until" + sketch when 1..7 days out', () => {
    const soon = trip('soon', '2026-06-18T10:00:00Z', { title: 'Goa weekend' });
    const out = nowCardPersonalised(NOW, soon);
    expect(out.headline).toBe('3 days until Goa weekend');
    expect(out.suggestion).toBe('Sketch the day-1 itinerary.');
    expect(out.verb).toBe('Sketch');
  });

  it('singular "day" when exactly 1', () => {
    const tomorrow = trip('tomorrow', '2026-06-16T10:00:00Z', { title: 'Mumbai pop' });
    const out = nowCardPersonalised(NOW, tomorrow);
    expect(out.headline).toBe('1 day until Mumbai pop');
  });

  it('"<N> days until" + polish when 8..30 days out', () => {
    const t = trip('mid', '2026-06-30T10:00:00Z', { title: 'Jaipur' });
    const out = nowCardPersonalised(NOW, t);
    expect(out.headline).toBe('15 days until Jaipur');
    expect(out.suggestion).toBe('Polish the plan.');
    expect(out.verb).toBe('Polish');
  });

  it('falls back when trip startsOn invalid', () => {
    const broken = trip('broken', null);
    const out = nowCardPersonalised(NOW, broken);
    expect(out.headline).toBe('Morning');
  });
});
