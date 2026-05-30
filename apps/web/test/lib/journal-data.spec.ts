/**
 * Vitest data-shape gate (AE177) for the journal article dataset.
 *
 * 6 long-form articles drive: the journal index, /aether/journal/[slug]
 * SSG, the RSS + Atom feeds, the destination cross-link helper, and
 * the tag-filter chips. This spec asserts the contract.
 */
import { describe, expect, it } from 'vitest';
import { ALL_JOURNAL_SLUGS, JOURNAL_ARTICLES } from '../../src/components/aether/journal/data';

describe('JOURNAL_ARTICLES dataset', () => {
  it('ALL_JOURNAL_SLUGS has the Phase 0 article count (≥ 6)', () => {
    expect(ALL_JOURNAL_SLUGS.length).toBeGreaterThanOrEqual(6);
  });

  it('ALL_JOURNAL_SLUGS has no duplicates', () => {
    expect(new Set<string>(ALL_JOURNAL_SLUGS).size).toBe(ALL_JOURNAL_SLUGS.length);
  });

  it('every slug maps to an article', () => {
    for (const slug of ALL_JOURNAL_SLUGS) {
      expect(JOURNAL_ARTICLES[slug]).toBeDefined();
    }
  });

  it('every slug is lowercase kebab', () => {
    for (const slug of ALL_JOURNAL_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every article has kicker / title / dek + non-trivial body', () => {
    for (const slug of ALL_JOURNAL_SLUGS) {
      const a = JOURNAL_ARTICLES[slug]!;
      expect(a.kicker.length).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.dek.length).toBeGreaterThan(0);
      // body is an array of structured paragraph blocks; at least 1
      // and each block has a non-empty text field.
      expect(Array.isArray(a.body)).toBe(true);
      expect(a.body.length).toBeGreaterThan(0);
      for (const block of a.body) {
        expect(block.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('every kicker carries a middle-dot (tag · stem convention)', () => {
    // Sanity for AE173 tagOf — every kicker must have at least one ·
    // so the index's tag column is populated.
    for (const slug of ALL_JOURNAL_SLUGS) {
      const a = JOURNAL_ARTICLES[slug]!;
      expect(a.kicker).toContain('·');
    }
  });

  it('hero photo carries id + by + alt fields', () => {
    for (const slug of ALL_JOURNAL_SLUGS) {
      const a = JOURNAL_ARTICLES[slug]!;
      expect(typeof a.hero.id).toBe('string');
      expect(a.hero.id.length).toBeGreaterThan(0);
      expect(typeof a.hero.by).toBe('string');
      expect(typeof a.hero.alt).toBe('string');
    }
  });
});
