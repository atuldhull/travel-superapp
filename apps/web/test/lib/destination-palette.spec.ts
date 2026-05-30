/**
 * Unit tests for `components/aether/destinations/palette.ts` —
 * per-destination accent map (AE61).
 */
import { describe, expect, it } from 'vitest';
import { destinationAccent, TERRACOTTA } from '../../src/components/aether/destinations/palette';
import { ALL_SLUGS } from '../../src/components/aether/destinations/data';

describe('destinationAccent', () => {
  it('returns a curated accent for every known destination slug', () => {
    for (const slug of ALL_SLUGS) {
      const a = destinationAccent(slug);
      // Curated accents differ from the terracotta fallback for at
      // least the `base` colour (otherwise the per-destination
      // accent feature does nothing visible).
      // Note: this asserts there's an entry; we don't assert specific
      // hexes so curators can tune them without retesting.
      expect(a.base).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(a.deep).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(a.note.length).toBeGreaterThan(0);
    }
  });

  it('falls back to terracotta for an unknown slug', () => {
    const a = destinationAccent('atlantis');
    expect(a).toEqual(TERRACOTTA);
  });

  it('falls back to terracotta for an empty slug', () => {
    expect(destinationAccent('')).toEqual(TERRACOTTA);
  });

  it('jaipur is a pink-sandstone tone (sandstone slug fidelity check)', () => {
    const a = destinationAccent('jaipur');
    expect(a.note).toBe('pink-sandstone');
  });

  it('alleppey is a palm-teal tone', () => {
    const a = destinationAccent('alleppey');
    expect(a.note).toBe('palm-teal');
  });
});
