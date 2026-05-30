/**
 * Vitest specs for AE220 buildArticleMetaLine — the journal
 * article meta-line builder (author · readMins · publishedOn).
 */
import { describe, expect, it } from 'vitest';
import { buildArticleMetaLine } from '../../src/components/aether/journal/article-meta-line';

describe('buildArticleMetaLine', () => {
  it('full line: 3 segments joined by " · "', () => {
    const got = buildArticleMetaLine({
      author: 'Atul Dhull',
      readMins: 6,
      publishedOn: 'May 12 · 2026',
    });
    expect(got.segments).toEqual(['By Atul Dhull', '6 min read', 'May 12 · 2026']);
    expect(got.joined).toBe('By Atul Dhull · 6 min read · May 12 · 2026');
  });

  it('drops missing author segment', () => {
    const got = buildArticleMetaLine({
      author: '',
      readMins: 8,
      publishedOn: 'Apr 1 · 2026',
    });
    expect(got.segments).toEqual(['8 min read', 'Apr 1 · 2026']);
    expect(got.joined).toBe('8 min read · Apr 1 · 2026');
  });

  it('drops 0-min read', () => {
    const got = buildArticleMetaLine({
      author: 'Anon',
      readMins: 0,
      publishedOn: 'May 1 · 2026',
    });
    expect(got.segments).toEqual(['By Anon', 'May 1 · 2026']);
  });

  it('drops missing publishedOn', () => {
    const got = buildArticleMetaLine({
      author: 'Anon',
      readMins: 5,
      publishedOn: '',
    });
    expect(got.segments).toEqual(['By Anon', '5 min read']);
  });

  it('whitespace-only fields are treated as empty', () => {
    const got = buildArticleMetaLine({
      author: '   ',
      readMins: 3,
      publishedOn: '\t  \n',
    });
    expect(got.segments).toEqual(['3 min read']);
  });

  it('trims surviving fields', () => {
    const got = buildArticleMetaLine({
      author: '  Ada  ',
      readMins: 3,
      publishedOn: '  Jun 1  ',
    });
    expect(got.segments).toEqual(['By Ada', '3 min read', 'Jun 1']);
  });

  it('empty everything → empty segments + empty joined', () => {
    const got = buildArticleMetaLine({ author: '', readMins: 0, publishedOn: '' });
    expect(got.segments).toEqual([]);
    expect(got.joined).toBe('');
  });

  it('negative readMins is treated as missing', () => {
    const got = buildArticleMetaLine({
      author: 'A',
      readMins: -1,
      publishedOn: 'X',
    });
    expect(got.segments).toEqual(['By A', 'X']);
  });
});
