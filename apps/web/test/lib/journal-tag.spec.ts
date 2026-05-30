/**
 * Tagging logic for the journal tag filter (AE74). The function is
 * defined inline in `journal-index.tsx`; replicated here so the
 * invariant ("stem before `·` is the canonical tag") is asserted
 * separately from the index component's render path.
 */
import { describe, expect, it } from 'vitest';

function tagOf(kicker: string): string {
  const idx = kicker.indexOf('·');
  return (idx === -1 ? kicker : kicker.slice(0, idx)).trim();
}

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
});
