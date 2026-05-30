/**
 * Vitest data-shape gate (AE176) for the destination dataset.
 *
 * The AE7+AE26 destination data drives 15 SSG routes, Atlas pins, the
 * compare surface, the journey checklist starter picker, etc. Bad
 * data here cascades; this spec asserts the contract:
 *   • Each slug in ALL_SLUGS is present in DESTINATIONS
 *   • Every record has name + state + tagline + lede + photo
 *   • Slugs are kebab-case
 *   • Photo objects have id + by + alt
 *   • No duplicate slugs in ALL_SLUGS
 */
import { describe, expect, it } from 'vitest';
import { ALL_SLUGS, DESTINATIONS } from '../../src/components/aether/destinations/data';

describe('DESTINATIONS dataset', () => {
  it('ALL_SLUGS has 15 entries (Phase 0 curated set)', () => {
    expect(ALL_SLUGS.length).toBe(15);
  });

  it('ALL_SLUGS has no duplicates', () => {
    expect(new Set<string>(ALL_SLUGS).size).toBe(ALL_SLUGS.length);
  });

  it('every ALL_SLUGS entry maps to a record in DESTINATIONS', () => {
    for (const slug of ALL_SLUGS) {
      expect(DESTINATIONS[slug]).toBeDefined();
    }
  });

  it('every slug is lowercase kebab (a-z + 0-9 + dashes only)', () => {
    for (const slug of ALL_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every record carries name + state + tagline', () => {
    for (const slug of ALL_SLUGS) {
      const d = DESTINATIONS[slug]!;
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.state.length).toBeGreaterThan(0);
      expect(d.tagline.length).toBeGreaterThan(0);
    }
  });

  it('every hero photo has id / by / alt fields', () => {
    for (const slug of ALL_SLUGS) {
      const d = DESTINATIONS[slug]!;
      expect(typeof d.hero.id).toBe('string');
      expect(d.hero.id.length).toBeGreaterThan(0);
      expect(typeof d.hero.by).toBe('string');
      expect(typeof d.hero.alt).toBe('string');
    }
  });

  it('every record carries a non-empty lede paragraph', () => {
    for (const slug of ALL_SLUGS) {
      const d = DESTINATIONS[slug]!;
      expect(d.lede.length).toBeGreaterThan(10);
    }
  });
});
