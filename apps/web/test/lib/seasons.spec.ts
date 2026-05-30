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

// ─── AE134: edge-case month coverage ──────────────────────────────
describe('seasonality — edge months', () => {
  it('every slug has at least one in-season month within Jan–Dec', () => {
    // Sanity gate: ensure no slug is defined with an empty month-set
    // (which would silently disable its in-season chip everywhere).
    const slugs = [
      'leh',
      'spiti',
      'darjeeling',
      'shillong',
      'jaipur',
      'udaipur',
      'bhuj',
      'varanasi',
      'mumbai',
      'anjuna',
      'hampi',
      'coorg',
      'pondicherry',
      'madurai',
      'alleppey',
    ];
    for (const slug of slugs) {
      let ever = false;
      for (let m = 1; m <= 12; m += 1) {
        if (isInSeason(slug, at(m))) {
          ever = true;
          break;
        }
      }
      expect(ever).toBe(true);
    }
  });

  it('high-Himalaya slugs (Leh, Spiti) are out in deep winter (Jan)', () => {
    expect(isInSeason('leh', at(1))).toBe(false);
    expect(isInSeason('spiti', at(1))).toBe(false);
  });

  it('Mumbai is out during peak monsoon (July)', () => {
    expect(isInSeason('mumbai', at(7))).toBe(false);
  });

  it('Coorg is in season during winter (Jan)', () => {
    expect(isInSeason('coorg', at(1))).toBe(true);
  });

  it('inSeasonSlugs returns at least 2 slugs every month (no empty windows)', () => {
    // The low floor (Apr-Aug) is the high-Himalaya pair Leh + Spiti, and
    // Apr-May adds Darjeeling + Shillong. Two slugs is the genuine
    // calendar minimum, not 4 — keep this assertion realistic.
    for (let m = 1; m <= 12; m += 1) {
      const got = inSeasonSlugs(at(m));
      expect(got.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('inSeasonSlugs is stable across the same date (idempotent)', () => {
    const a = inSeasonSlugs(at(3));
    const b = inSeasonSlugs(at(3));
    expect(a).toEqual(b);
  });
});
