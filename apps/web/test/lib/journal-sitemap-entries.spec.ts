/**
 * Vitest specs for AE271 journalSitemapEntries.
 */
import { describe, expect, it } from 'vitest';
import { journalSitemapEntries } from '../../src/components/aether/journal/sitemap-entries';

const ORIGIN = 'https://app.example.com';
const FB = '2026-05-30T00:00:00Z';

describe('journalSitemapEntries', () => {
  it('empty input → []', () => {
    expect(journalSitemapEntries([], { origin: ORIGIN, fallbackLastmod: FB })).toEqual([]);
  });

  it('newest publishedOn first', () => {
    const got = journalSitemapEntries(
      [
        { slug: 'a', publishedOn: '2026-01-01' },
        { slug: 'b', publishedOn: '2026-05-30' },
        { slug: 'c', publishedOn: '2026-03-15' },
      ],
      { origin: ORIGIN, fallbackLastmod: FB },
    );
    expect(got.map((e) => e.url)).toEqual([
      'https://app.example.com/aether/journal/b',
      'https://app.example.com/aether/journal/c',
      'https://app.example.com/aether/journal/a',
    ]);
  });

  it('updatedAt overrides publishedOn for lastmod', () => {
    const got = journalSitemapEntries(
      [{ slug: 'a', publishedOn: '2026-01-01', updatedAt: '2026-05-30' }],
      { origin: ORIGIN, fallbackLastmod: FB },
    );
    expect(got[0]?.lastmod).toBe('2026-05-30');
  });

  it('publishedOn used when updatedAt missing', () => {
    const got = journalSitemapEntries([{ slug: 'a', publishedOn: '2026-01-01' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.lastmod).toBe('2026-01-01');
  });

  it('falls back when both missing', () => {
    const got = journalSitemapEntries([{ slug: 'a' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.lastmod).toBe(FB);
  });

  it('empty slug dropped', () => {
    const got = journalSitemapEntries(
      [
        { slug: '', publishedOn: '2026-05-30' },
        { slug: 'a', publishedOn: '2026-05-30' },
      ],
      { origin: ORIGIN, fallbackLastmod: FB },
    );
    expect(got.length).toBe(1);
  });

  it('default priority 0.6', () => {
    const got = journalSitemapEntries([{ slug: 'a' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.priority).toBe(0.6);
  });
});
