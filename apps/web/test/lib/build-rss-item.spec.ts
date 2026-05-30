/**
 * Vitest specs for AE274 buildRssItem.
 */
import { describe, expect, it } from 'vitest';
import { buildRssItem } from '../../src/components/aether/journal/build-rss-item';

const ORIGIN = 'https://app.example.com';

describe('buildRssItem', () => {
  it('minimum required fields', () => {
    const out = buildRssItem({
      slug: 'chai-in-leh',
      title: 'Chai in Leh',
      publishedOn: '2026-05-30T00:00:00Z',
      origin: ORIGIN,
    });
    expect(out).toContain('<title>Chai in Leh</title>');
    expect(out).toContain('https://app.example.com/aether/journal/chai-in-leh');
    expect(out).toContain('<pubDate>');
  });

  it('starts with <item> and ends with </item>', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: '2026-01-01',
      origin: ORIGIN,
    });
    expect(out.startsWith('<item>')).toBe(true);
    expect(out.endsWith('</item>')).toBe(true);
  });

  it('omits <dc:creator> when no author given', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: '2026-01-01',
      origin: ORIGIN,
    });
    expect(out).not.toContain('<dc:creator>');
  });

  it('includes <dc:creator> when author given', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: '2026-01-01',
      origin: ORIGIN,
      author: 'Atul Dhull',
    });
    expect(out).toContain('<dc:creator>Atul Dhull</dc:creator>');
  });

  it('escapes special chars in title', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 'A & B <c>',
      publishedOn: '2026-01-01',
      origin: ORIGIN,
    });
    expect(out).toContain('<title>A &amp; B &lt;c&gt;</title>');
  });

  it('renders an RFC 2822-ish UTC pubDate', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: '2026-05-30T00:00:00Z',
      origin: ORIGIN,
    });
    expect(out).toMatch(
      /<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} 2026 \d{2}:\d{2}:\d{2} GMT<\/pubDate>/,
    );
  });

  it('unparseable publishedOn falls back to epoch', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: 'garbage',
      origin: ORIGIN,
    });
    expect(out).toContain('1970');
  });

  it('includes summary when given', () => {
    const out = buildRssItem({
      slug: 'a',
      title: 't',
      publishedOn: '2026-01-01',
      origin: ORIGIN,
      summary: 'A short opener',
    });
    expect(out).toContain('<description>A short opener</description>');
  });
});
