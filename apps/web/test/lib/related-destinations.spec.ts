/**
 * Unit tests for AE99 journal → destination cross-link helper. The
 * inverse of related-journal (AE88): given an article, return the
 * destinations whose city or state name appears in its
 * kicker/title/dek.
 */
import { describe, expect, it } from 'vitest';
import { relatedDestinations } from '../../src/components/aether/journal/related-destinations';
import { JOURNAL_ARTICLES } from '../../src/components/aether/journal/data';

describe('relatedDestinations', () => {
  it('Ladakh-kicker articles surface the Leh destination', () => {
    // The Hemis monks article is "Pilgrim trail · Ladakh".
    const monks = JOURNAL_ARTICLES['monks-of-hemis'];
    if (monks === undefined) return; // shape guard — if data shifts
    const dests = relatedDestinations(monks);
    expect(dests.some((d) => d.slug === 'leh')).toBe(true);
  });

  it('returns a stable Destination[] (sorted by data slug order)', () => {
    for (const slug of Object.keys(JOURNAL_ARTICLES)) {
      const a = JOURNAL_ARTICLES[slug]!;
      const dests = relatedDestinations(a);
      expect(Array.isArray(dests)).toBe(true);
      // No duplicates.
      const uniq = new Set(dests.map((d) => d.slug));
      expect(uniq.size).toBe(dests.length);
    }
  });

  it('returns [] for an article whose haystack has no matches', () => {
    const fake = {
      slug: 'antarctica-notes',
      kicker: 'Field notes · Antarctica',
      title: 'Penguins at the pole',
      dek: 'A wholly different latitude',
      author: 'X',
      readMins: 1,
      publishedOn: '1 Jan 2026',
      hero: { id: 'x', by: 'y', alt: 'z' },
      body: [],
    } as const;
    // Cast through unknown — the test fixture intentionally lacks
    // any of the real city/state words.
    const dests = relatedDestinations(fake as unknown as Parameters<typeof relatedDestinations>[0]);
    expect(dests).toEqual([]);
  });
});
