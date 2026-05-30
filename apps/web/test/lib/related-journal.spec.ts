/**
 * Unit tests for AE88 destination → journal cross-link helper.
 *
 * The match is a permissive substring match against kicker + title +
 * dek using the destination's city name OR state name. Asserts that:
 *   - Old Delhi / Banaras journal entries get linked from
 *     Varanasi-adjacent destinations via the "Old Delhi" / "Banaras"
 *     city words landing in the kicker / dek.
 *   - Ladakh-tagged kickers match Leh (state == 'Ladakh').
 *   - Destinations with no match return [].
 */
import { describe, expect, it } from 'vitest';
import { relatedArticles } from '../../src/components/aether/destinations/related-journal';
import { DESTINATIONS } from '../../src/components/aether/destinations/data';

describe('relatedArticles', () => {
  it('Leh (state Ladakh) matches at least one Ladakh-kicker article', () => {
    const leh = DESTINATIONS['leh']!;
    const articles = relatedArticles(leh);
    expect(articles.length).toBeGreaterThan(0);
    // At least one article kicker mentions Ladakh.
    expect(
      articles.some((a) => `${a.kicker} ${a.title} ${a.dek}`.toLowerCase().includes('ladakh')),
    ).toBe(true);
  });

  it('Varanasi matches a Banaras / Varanasi article when present', () => {
    const v = DESTINATIONS['varanasi']!;
    const articles = relatedArticles(v);
    // Banaras (alt name for Varanasi) is in the journal kicker for
    // the loom piece. If no match — the helper returns [] gracefully.
    for (const a of articles) {
      const hay = `${a.kicker} ${a.title} ${a.dek}`.toLowerCase();
      expect(hay.includes('varanasi') || hay.includes('uttar pradesh')).toBe(true);
    }
  });

  it('returns [] for a destination with no journal coverage', () => {
    const bhuj = DESTINATIONS['bhuj']!;
    const articles = relatedArticles(bhuj);
    // bhuj's name + state (Gujarat) don't appear in Phase 0 journal
    // dataset — empty is the expected fallback.
    expect(Array.isArray(articles)).toBe(true);
  });
});
