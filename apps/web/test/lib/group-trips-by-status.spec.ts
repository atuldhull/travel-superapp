/**
 * Vitest specs for AE237 groupTripsByStatus.
 */
import { describe, expect, it } from 'vitest';
import { groupTripsByStatus } from '../../src/components/aether/me/group-trips-by-status';

const NOW = new Date('2026-06-15T12:00:00Z');

const mk = (
  id: string,
  startsOn: string | null,
  endsOn: string | null,
  archivedAt: string | null = null,
): { id: string; startsOn: string | null; endsOn: string | null; archivedAt: string | null } => ({
  id,
  startsOn,
  endsOn,
  archivedAt,
});

describe('groupTripsByStatus', () => {
  it('empty input → all empty buckets', () => {
    const got = groupTripsByStatus([], NOW);
    expect(got).toEqual({
      active: [],
      upcoming: [],
      past: [],
      archived: [],
      draft: [],
    });
  });

  it('routes each trip to its derived status bucket', () => {
    const got = groupTripsByStatus(
      [
        mk('draft-1', null, null),
        mk('upcoming-1', '2026-07-01', '2026-07-05'),
        mk('active-1', '2026-06-10', '2026-06-20'),
        mk('past-1', '2026-05-01', '2026-05-10'),
        mk('archived-1', '2026-06-10', '2026-06-20', '2026-06-12'),
      ],
      NOW,
    );
    expect(got.draft.map((t) => t.id)).toEqual(['draft-1']);
    expect(got.upcoming.map((t) => t.id)).toEqual(['upcoming-1']);
    expect(got.active.map((t) => t.id)).toEqual(['active-1']);
    expect(got.past.map((t) => t.id)).toEqual(['past-1']);
    expect(got.archived.map((t) => t.id)).toEqual(['archived-1']);
  });

  it('preserves input order within each bucket', () => {
    const got = groupTripsByStatus(
      [
        mk('active-A', '2026-06-10', '2026-06-20'),
        mk('active-B', '2026-06-10', '2026-06-20'),
        mk('active-C', '2026-06-10', '2026-06-20'),
      ],
      NOW,
    );
    expect(got.active.map((t) => t.id)).toEqual(['active-A', 'active-B', 'active-C']);
  });

  it('all-archived input fills the archived bucket only', () => {
    const got = groupTripsByStatus(
      [
        mk('a', '2026-06-10', '2026-06-20', '2026-06-12'),
        mk('b', '2026-05-10', '2026-05-20', '2026-05-22'),
      ],
      NOW,
    );
    expect(got.archived.length).toBe(2);
    expect(got.active.length).toBe(0);
    expect(got.past.length).toBe(0);
  });

  it('bucket sum equals input length (no trip dropped)', () => {
    const trips = [
      mk('1', null, null),
      mk('2', '2026-07-01', '2026-07-05'),
      mk('3', '2026-06-10', '2026-06-20'),
      mk('4', '2026-05-01', '2026-05-10'),
      mk('5', null, null, '2026-06-01'),
    ];
    const got = groupTripsByStatus(trips, NOW);
    const total =
      got.active.length +
      got.upcoming.length +
      got.past.length +
      got.archived.length +
      got.draft.length;
    expect(total).toBe(trips.length);
  });
});
