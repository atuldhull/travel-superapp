/**
 * Tagging logic for the journal tag filter (AE74).
 * Extracted to ./tag-of.ts in AE173 so the spec now imports the
 * shipping helper instead of duplicating it.
 */
import { describe, expect, it } from 'vitest';
import { tagOf } from '../../src/components/aether/journal/tag-of';

describe('journal tagOf', () => {
  it('splits at the bullet and trims', () => {
    expect(tagOf('Field notes · Old Delhi')).toBe('Field notes');
    expect(tagOf('Pilgrim trail · Ladakh')).toBe('Pilgrim trail');
    expect(tagOf('Craft · Banaras')).toBe('Craft');
  });

  it('handles whitespace around the bullet', () => {
    expect(tagOf('  Field notes  ·   Old Delhi  ')).toBe('Field notes');
  });

  it('returns the whole kicker when no bullet is present', () => {
    expect(tagOf('Field notes')).toBe('Field notes');
  });

  it('treats the empty string as itself', () => {
    expect(tagOf('')).toBe('');
  });

  it('multi-word stems before the bullet survive', () => {
    expect(tagOf('Field notes from the road · Place')).toBe('Field notes from the road');
  });

  // ─── AE173: extended edge cases ─────────────────────────────────────
  it('stops at the first bullet when more than one is present', () => {
    expect(tagOf('A · B · C')).toBe('A');
  });

  it('leaves the bullet character on the stem when it is not the standard middle-dot', () => {
    // ASCII bullet `*` should NOT match — only middle-dot `·` is the
    // separator convention.
    expect(tagOf('Field notes * Place')).toBe('Field notes * Place');
  });
});
