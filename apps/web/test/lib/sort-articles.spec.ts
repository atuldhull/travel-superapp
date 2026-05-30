/**
 * Vitest specs for AE236 sortArticlesNewestFirst.
 */
import { describe, expect, it } from 'vitest';
import { sortArticlesNewestFirst } from '../../src/components/aether/journal/sort-articles';

const mk = (slug: string, publishedOn: string): { slug: string; publishedOn: string } => ({
  slug,
  publishedOn,
});

describe('sortArticlesNewestFirst', () => {
  it('newest publishedOn first', () => {
    const got = sortArticlesNewestFirst([
      mk('a', '2026-01-01'),
      mk('b', '2026-05-30'),
      mk('c', '2026-03-15'),
    ]);
    expect(got.map((a) => a.slug)).toEqual(['b', 'c', 'a']);
  });

  it('does NOT mutate the input', () => {
    const input = [mk('a', '2026-01-01'), mk('b', '2026-05-30')];
    const ref = input.slice();
    const out = sortArticlesNewestFirst(input);
    expect(input).toEqual(ref);
    expect(out).not.toBe(input);
  });

  it('stable tie-break by original index', () => {
    const got = sortArticlesNewestFirst([
      mk('a', '2026-05-30'),
      mk('b', '2026-05-30'),
      mk('c', '2026-05-30'),
    ]);
    expect(got.map((a) => a.slug)).toEqual(['a', 'b', 'c']);
  });

  it('unparseable date sorts to the end', () => {
    const got = sortArticlesNewestFirst([
      mk('a', 'garbage'),
      mk('b', '2026-05-30'),
      mk('c', '2026-01-01'),
    ]);
    expect(got.map((a) => a.slug)).toEqual(['b', 'c', 'a']);
  });

  it('empty input → []', () => {
    expect(sortArticlesNewestFirst([])).toEqual([]);
  });

  it('single article passes through', () => {
    expect(sortArticlesNewestFirst([mk('x', '2026-01-01')])).toEqual([mk('x', '2026-01-01')]);
  });

  it('mixed parseable + unparseable, ties on unparseables preserved', () => {
    const got = sortArticlesNewestFirst([
      mk('z', 'bad-z'), // unparseable
      mk('a', '2026-05-30'),
      mk('y', 'bad-y'), // unparseable
    ]);
    expect(got.map((a) => a.slug)).toEqual(['a', 'z', 'y']);
  });
});
