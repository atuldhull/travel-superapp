/**
 * Vitest specs for AE250 computeShareListStats.
 */
import { describe, expect, it } from 'vitest';
import { computeShareListStats } from '../../src/components/aether/journey/share-list-stats';

describe('computeShareListStats', () => {
  it('empty → zeros + null mostRecent', () => {
    expect(computeShareListStats([])).toEqual({
      total: 0,
      revoked: 0,
      live: 0,
      mostRecentAt: null,
    });
  });

  it('counts live shares + finds the latest', () => {
    expect(
      computeShareListStats([
        { createdAt: '2026-06-01T00:00:00Z', revokedAt: null },
        { createdAt: '2026-06-05T00:00:00Z', revokedAt: null },
        { createdAt: '2026-06-03T00:00:00Z', revokedAt: null },
      ]),
    ).toEqual({
      total: 3,
      revoked: 0,
      live: 3,
      mostRecentAt: '2026-06-05T00:00:00Z',
    });
  });

  it('revoked shares count in total but not in mostRecentAt', () => {
    expect(
      computeShareListStats([
        { createdAt: '2026-06-10T00:00:00Z', revokedAt: '2026-06-11T00:00:00Z' },
        { createdAt: '2026-06-05T00:00:00Z', revokedAt: null },
      ]),
    ).toEqual({
      total: 2,
      revoked: 1,
      live: 1,
      mostRecentAt: '2026-06-05T00:00:00Z',
    });
  });

  it('null createdAt skipped entirely', () => {
    expect(
      computeShareListStats([
        { createdAt: null, revokedAt: null },
        { createdAt: '2026-06-01T00:00:00Z', revokedAt: null },
      ]),
    ).toEqual({
      total: 1,
      revoked: 0,
      live: 1,
      mostRecentAt: '2026-06-01T00:00:00Z',
    });
  });

  it('empty-string revokedAt treated as live (no revoke)', () => {
    expect(computeShareListStats([{ createdAt: '2026-06-01T00:00:00Z', revokedAt: '' }])).toEqual({
      total: 1,
      revoked: 0,
      live: 1,
      mostRecentAt: '2026-06-01T00:00:00Z',
    });
  });

  it('all revoked → live=0 + mostRecentAt=null', () => {
    expect(
      computeShareListStats([
        { createdAt: '2026-06-01T00:00:00Z', revokedAt: '2026-06-02T00:00:00Z' },
        { createdAt: '2026-06-03T00:00:00Z', revokedAt: '2026-06-04T00:00:00Z' },
      ]),
    ).toEqual({
      total: 2,
      revoked: 2,
      live: 0,
      mostRecentAt: null,
    });
  });

  it('unparseable createdAt counts in total but not in mostRecentAt', () => {
    expect(computeShareListStats([{ createdAt: 'bogus', revokedAt: null }])).toEqual({
      total: 1,
      revoked: 0,
      live: 1,
      mostRecentAt: null,
    });
  });
});
