/**
 * Unit tests for AE83 destination seasonality helpers.
 *
 * Each `now` is passed explicitly so the test isn't time-of-year
 * flaky. We sample one month-in and one month-out per destination.
 */
import { describe, expect, it } from 'vitest';
import {
  inSeasonSlugs,
  isInSeason,
  seasonLabel,
} from '../../src/components/aether/destinations/seasons';

const at = (month: number): Date => new Date(2026, month - 1, 15);

describe('isInSeason', () => {
  it('Leh is in season July, out in January', () => {
    expect(isInSeason('leh', at(7))).toBe(true);
    expect(isInSeason('leh', at(1))).toBe(false);
  });

  it('Jaipur is in season November, out in May', () => {
    expect(isInSeason('jaipur', at(11))).toBe(true);
    expect(isInSeason('jaipur', at(5))).toBe(false);
  });

  it('Alleppey is in season February, out in July', () => {
    expect(isInSeason('alleppey', at(2))).toBe(true);
    expect(isInSeason('alleppey', at(7))).toBe(false);
  });

  it('Anjuna is in season January, out in June', () => {
    expect(isInSeason('anjuna', at(1))).toBe(true);
    expect(isInSeason('anjuna', at(6))).toBe(false);
  });

  it('unknown slug is always off-peak', () => {
    expect(isInSeason('atlantis', at(1))).toBe(false);
    expect(isInSeason('atlantis', at(7))).toBe(false);
  });
});

describe('inSeasonSlugs', () => {
  it('returns the Leh+Spiti high-Himalaya pair in mid-July', () => {
    const slugs = inSeasonSlugs(at(7));
    expect(slugs).toContain('leh');
    expect(slugs).toContain('spiti');
    // Jaipur isn't in season July.
    expect(slugs).not.toContain('jaipur');
  });

  it('returns a wide list in mid-January (peak winter month)', () => {
    const slugs = inSeasonSlugs(at(1));
    expect(slugs).toContain('jaipur');
    expect(slugs).toContain('alleppey');
    expect(slugs).toContain('hampi');
    expect(slugs).not.toContain('leh');
  });
});

describe('seasonLabel', () => {
  it('says "In season now" when slug matches the month', () => {
    expect(seasonLabel('jaipur', at(11))).toBe('In season now');
  });

  it('says "Off-peak" otherwise', () => {
    expect(seasonLabel('jaipur', at(5))).toBe('Off-peak');
  });
});
