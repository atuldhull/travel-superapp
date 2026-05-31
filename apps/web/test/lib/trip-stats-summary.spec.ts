/**
 * Vitest specs for AE327 summariseTripStats.
 */
import { describe, expect, it } from 'vitest';
import { summariseTripStats } from '../../src/components/aether/me/trip-stats-summary';

const t = (status: string) => ({ status });

describe('summariseTripStats', () => {
  it('empty lists → zeros across the board', () => {
    expect(summariseTripStats({ active: [], archived: [] })).toEqual({
      drafts: 0,
      active: 0,
      archived: 0,
      totalTrips: 0,
    });
  });

  it('counts drafts inside active only', () => {
    const out = summariseTripStats({
      active: [t('draft'), t('draft'), t('planning'), t('booked')],
      archived: [t('draft')], // archived drafts do NOT count toward `drafts`
    });
    expect(out.drafts).toBe(2);
    expect(out.active).toBe(4);
    expect(out.archived).toBe(1);
    expect(out.totalTrips).toBe(5);
  });

  it('totalTrips = active + archived', () => {
    const out = summariseTripStats({
      active: [t('a'), t('b'), t('c')],
      archived: [t('x'), t('y')],
    });
    expect(out.totalTrips).toBe(5);
  });

  it('missing or null status never counts as a draft', () => {
    const out = summariseTripStats({
      active: [{}, { status: null }, { status: undefined }, t('draft')],
      archived: [],
    });
    expect(out.drafts).toBe(1);
    expect(out.active).toBe(4);
  });

  it('all-archived case (no drafts surface)', () => {
    const out = summariseTripStats({
      active: [],
      archived: [t('draft'), t('booked'), t('archived')],
    });
    expect(out.drafts).toBe(0);
    expect(out.archived).toBe(3);
    expect(out.totalTrips).toBe(3);
  });

  it('returns a plain object (not frozen) so consumers can spread', () => {
    const out = summariseTripStats({ active: [t('draft')], archived: [] });
    const next = { ...out, custom: 42 };
    expect(next.drafts).toBe(1);
    expect(next.custom).toBe(42);
  });
});
