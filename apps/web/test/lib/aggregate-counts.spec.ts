/**
 * Vitest specs for AE259 aggregateMeCounts.
 */
import { describe, expect, it } from 'vitest';
import { aggregateMeCounts } from '../../src/components/aether/me/aggregate-counts';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('aggregateMeCounts', () => {
  it('empty input → all zeros', () => {
    expect(aggregateMeCounts([], NOW)).toEqual({
      totalTrips: 0,
      active: 0,
      upcoming: 0,
      past: 0,
      archived: 0,
      draft: 0,
      liveShares: 0,
    });
  });

  it('counts by status', () => {
    const got = aggregateMeCounts(
      [
        { startsOn: null, endsOn: null, archivedAt: null }, // draft
        { startsOn: '2026-07-01', endsOn: '2026-07-05', archivedAt: null }, // upcoming
        { startsOn: '2026-06-10', endsOn: '2026-06-20', archivedAt: null }, // active
        { startsOn: '2026-05-01', endsOn: '2026-05-10', archivedAt: null }, // past
        { startsOn: '2026-06-10', endsOn: '2026-06-20', archivedAt: '2026-06-12' }, // archived
      ],
      NOW,
    );
    expect(got).toMatchObject({
      totalTrips: 5,
      draft: 1,
      upcoming: 1,
      active: 1,
      past: 1,
      archived: 1,
    });
  });

  it('sum of buckets equals totalTrips', () => {
    const trips = [
      { startsOn: null, endsOn: null, archivedAt: null },
      { startsOn: '2026-07-01', endsOn: '2026-07-05', archivedAt: null },
      { startsOn: '2026-06-10', endsOn: '2026-06-20', archivedAt: null },
    ];
    const got = aggregateMeCounts(trips, NOW);
    expect(got.active + got.upcoming + got.past + got.archived + got.draft).toBe(got.totalTrips);
  });

  it('sums live shares across trips', () => {
    const got = aggregateMeCounts(
      [
        {
          startsOn: '2026-06-10',
          endsOn: '2026-06-20',
          archivedAt: null,
          shares: [
            { createdAt: '2026-06-01T00:00:00Z', revokedAt: null },
            { createdAt: '2026-06-02T00:00:00Z', revokedAt: null },
          ],
        },
        {
          startsOn: '2026-07-01',
          endsOn: '2026-07-05',
          archivedAt: null,
          shares: [{ createdAt: '2026-06-03T00:00:00Z', revokedAt: null }],
        },
      ],
      NOW,
    );
    expect(got.liveShares).toBe(3);
  });

  it('does NOT count revoked shares in liveShares', () => {
    const got = aggregateMeCounts(
      [
        {
          startsOn: '2026-06-10',
          endsOn: '2026-06-20',
          archivedAt: null,
          shares: [
            { createdAt: '2026-06-01T00:00:00Z', revokedAt: '2026-06-02T00:00:00Z' },
            { createdAt: '2026-06-03T00:00:00Z', revokedAt: null },
          ],
        },
      ],
      NOW,
    );
    expect(got.liveShares).toBe(1);
  });

  it('trips without shares are tolerated', () => {
    const got = aggregateMeCounts(
      [{ startsOn: '2026-06-10', endsOn: '2026-06-20', archivedAt: null }],
      NOW,
    );
    expect(got.liveShares).toBe(0);
  });
});
