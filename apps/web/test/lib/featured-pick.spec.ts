/**
 * Vitest specs for AE263 pickFeaturedDestination.
 */
import { describe, expect, it } from 'vitest';
import { pickFeaturedDestination } from '../../src/components/aether/destinations/featured-pick';

const D = [
  { slug: 'leh' },
  { slug: 'jaipur' },
  { slug: 'alleppey' },
  { slug: 'spiti' },
  { slug: 'varanasi' },
];

const ALWAYS_OUT = (): boolean => false;
const ALL_IN_SEASON = (): boolean => true;
const ONLY_LEH_IN_SEASON = (s: string): boolean => s === 'leh';

describe('pickFeaturedDestination', () => {
  it('empty catalogue → null', () => {
    expect(pickFeaturedDestination([], new Date(), { isInSeason: ALL_IN_SEASON })).toBeNull();
  });

  it('prefers an in-season destination when any are in season', () => {
    const got = pickFeaturedDestination(D, new Date(2026, 5, 15), {
      isInSeason: ONLY_LEH_IN_SEASON,
    });
    expect(got?.slug).toBe('leh');
  });

  it('falls back to the full catalogue when nothing is in season', () => {
    const got = pickFeaturedDestination(D, new Date(2026, 5, 15), { isInSeason: ALWAYS_OUT });
    expect(got).not.toBeNull();
  });

  it('same date + same catalogue → deterministic pick', () => {
    const same1 = pickFeaturedDestination(D, new Date(2026, 5, 15), { isInSeason: ALWAYS_OUT });
    const same2 = pickFeaturedDestination(D, new Date(2026, 5, 15), { isInSeason: ALWAYS_OUT });
    expect(same1?.slug).toBe(same2?.slug);
  });

  it('next day → may rotate', () => {
    const d1 = new Date(2026, 5, 15);
    const d2 = new Date(2026, 5, 16);
    const p1 = pickFeaturedDestination(D, d1, { isInSeason: ALWAYS_OUT });
    const p2 = pickFeaturedDestination(D, d2, { isInSeason: ALWAYS_OUT });
    expect(p2?.slug).not.toBe(p1?.slug);
  });

  it('rotation cycles through whole catalogue over 5 days (D.length=5)', () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const got = pickFeaturedDestination(D, new Date(2026, 5, 1 + i), { isInSeason: ALWAYS_OUT });
      if (got !== null) slugs.add(got.slug);
    }
    expect(slugs.size).toBe(5);
  });

  it('single in-season pin → always picks it', () => {
    const got = pickFeaturedDestination(D, new Date(2030, 11, 31), {
      isInSeason: (s: string) => s === 'jaipur',
    });
    expect(got?.slug).toBe('jaipur');
  });
});
