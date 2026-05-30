/**
 * Vitest specs for AE270 destinationSitemapEntries.
 */
import { describe, expect, it } from 'vitest';
import { destinationSitemapEntries } from '../../src/components/aether/destinations/sitemap-entries';

const ORIGIN = 'https://app.example.com';
const FB = '2026-05-30T00:00:00Z';

describe('destinationSitemapEntries', () => {
  it('empty input → []', () => {
    expect(destinationSitemapEntries([], { origin: ORIGIN, fallbackLastmod: FB })).toEqual([]);
  });

  it('builds absolute URLs', () => {
    const got = destinationSitemapEntries([{ slug: 'leh' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.url).toBe('https://app.example.com/aether/destinations/leh');
  });

  it('sorts alphabetically by slug', () => {
    const got = destinationSitemapEntries(
      [{ slug: 'jaipur' }, { slug: 'alleppey' }, { slug: 'varanasi' }],
      { origin: ORIGIN, fallbackLastmod: FB },
    );
    expect(got.map((e) => e.url)).toEqual([
      'https://app.example.com/aether/destinations/alleppey',
      'https://app.example.com/aether/destinations/jaipur',
      'https://app.example.com/aether/destinations/varanasi',
    ]);
  });

  it('uses per-destination updatedAt when present', () => {
    const got = destinationSitemapEntries([{ slug: 'leh', updatedAt: '2026-06-01T12:00:00Z' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.lastmod).toBe('2026-06-01T12:00:00Z');
  });

  it('falls back to fallbackLastmod', () => {
    const got = destinationSitemapEntries([{ slug: 'leh', updatedAt: null }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.lastmod).toBe(FB);
  });

  it('empty updatedAt string also falls back', () => {
    const got = destinationSitemapEntries([{ slug: 'leh', updatedAt: '' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.lastmod).toBe(FB);
  });

  it('drops destinations with empty slug', () => {
    const got = destinationSitemapEntries([{ slug: '' }, { slug: 'leh' }, { slug: '   ' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got.length).toBe(1);
    expect(got[0]?.url).toContain('leh');
  });

  it('priority defaults to 0.7', () => {
    const got = destinationSitemapEntries([{ slug: 'leh' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
    });
    expect(got[0]?.priority).toBe(0.7);
  });

  it('priority is overridable', () => {
    const got = destinationSitemapEntries([{ slug: 'leh' }], {
      origin: ORIGIN,
      fallbackLastmod: FB,
      priority: 0.9,
    });
    expect(got[0]?.priority).toBe(0.9);
  });
});
