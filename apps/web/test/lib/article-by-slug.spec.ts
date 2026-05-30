/**
 * Vitest specs for AE249 articleBySlug + indexOfArticleBySlug.
 */
import { describe, expect, it } from 'vitest';
import {
  articleBySlug,
  indexOfArticleBySlug,
} from '../../src/components/aether/journal/article-by-slug';

const A = [
  { slug: 'chai-in-leh', title: 'A' },
  { slug: 'ghats-at-dawn', title: 'B' },
  { slug: 'spiti-roads', title: 'C' },
];

describe('articleBySlug', () => {
  it('hit', () => {
    expect(articleBySlug(A, 'ghats-at-dawn')?.title).toBe('B');
  });
  it('miss → null', () => {
    expect(articleBySlug(A, 'mumbai-monsoon')).toBeNull();
  });
  it('empty slug → null', () => {
    expect(articleBySlug(A, '')).toBeNull();
  });
  it('empty list → null', () => {
    expect(articleBySlug([], 'chai-in-leh')).toBeNull();
  });
  it('case-sensitive', () => {
    expect(articleBySlug(A, 'CHAI-IN-LEH')).toBeNull();
  });
  it('trims input', () => {
    expect(articleBySlug(A, '  chai-in-leh  ')?.title).toBe('A');
  });
});

describe('indexOfArticleBySlug', () => {
  it('returns the index', () => {
    expect(indexOfArticleBySlug(A, 'chai-in-leh')).toBe(0);
    expect(indexOfArticleBySlug(A, 'spiti-roads')).toBe(2);
  });
  it('miss → -1', () => {
    expect(indexOfArticleBySlug(A, 'unknown')).toBe(-1);
  });
  it('empty → -1', () => {
    expect(indexOfArticleBySlug(A, '')).toBe(-1);
  });
});
