/**
 * Vitest specs for the AE183 trySeasonMatch helper (extracted from
 * journeys-index in AE107).
 *
 * Each `now` is passed explicitly so the test isn't calendar-flaky.
 */
import { describe, expect, it } from 'vitest';
import { trySeasonMatch } from '../../src/components/aether/me/try-season-match';

const NOV = new Date(2026, 10, 15); // Jaipur, Anjuna, Bhuj in season
const JUL = new Date(2026, 6, 15); // Leh, Spiti in season

describe('trySeasonMatch', () => {
  it('returns null when the title mentions no curated destination', () => {
    expect(trySeasonMatch('Family trip to Atlantis', NOV)).toBeNull();
    expect(trySeasonMatch('', NOV)).toBeNull();
  });

  it('returns null when the destination IS in the title but NOT in season', () => {
    // Leh is in season Jul, NOT in Nov.
    expect(trySeasonMatch('A Leh winter dream', NOV)).toBeNull();
  });

  it('returns slug + name for in-season match', () => {
    const got = trySeasonMatch('A November Jaipur run', NOV);
    expect(got?.slug).toBe('jaipur');
    expect(got?.name).toBe('Jaipur');
  });

  it('Leh matches in July', () => {
    expect(trySeasonMatch('Five days in Leh', JUL)).toEqual({ slug: 'leh', name: 'Leh' });
  });

  it('is case-insensitive on the title', () => {
    expect(trySeasonMatch('JAIPUR plan', NOV)?.slug).toBe('jaipur');
  });

  it('returns the first qualifying destination when multiple appear', () => {
    // Jaipur + Anjuna are both in season in Nov; ALL_SLUGS ordering
    // determines which wins. The deterministic answer keeps the chip
    // stable across renders.
    const got = trySeasonMatch('Jaipur to Anjuna loop', NOV);
    expect(got).not.toBeNull();
    // Whichever comes first in ALL_SLUGS — but it must be ONE of them.
    expect(['jaipur', 'anjuna']).toContain(got?.slug);
  });
});
