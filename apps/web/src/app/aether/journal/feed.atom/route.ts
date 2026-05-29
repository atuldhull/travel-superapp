/**
 * /aether/journal/feed.atom — Atom 1.0 alternative to /feed.xml.
 *
 * Reeder / NetNewsWire / Inoreader subscribers tend to prefer Atom
 * (richer per-entry HTML content). We ship both; the journal index
 * page links to the RSS one as the default, but the Atom feed is
 * discoverable via <link rel="alternate"/> on the page (Phase 1).
 *
 * Env-gated identical to feed.xml: 404 when AETHER_PREVIEW != '1'.
 */
import { NextResponse } from 'next/server';
import { ALL_JOURNAL_SLUGS, JOURNAL_ARTICLES } from '@/components/aether/journal/data';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://travelsuperapp.local';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function articleHtml(slug: string): string {
  const a = JOURNAL_ARTICLES[slug];
  if (a === undefined) return '';
  return a.body
    .map((block) => {
      if (block.kind === 'h2') return `<h2>${xmlEscape(block.text)}</h2>`;
      if (block.kind === 'pull') return `<blockquote>${xmlEscape(block.text)}</blockquote>`;
      return `<p>${xmlEscape(block.text)}</p>`;
    })
    .join('\n');
}

/** Atom requires `updated` in ISO 8601. We derive it from the
 *  article's `publishedOn` (which is a friendly date string). If
 *  parsing fails, fall back to now() — invalid `updated` rejects
 *  the entire feed in strict parsers. */
function isoOrNow(v: string): string {
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

export async function GET(): Promise<Response> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }

  const feedUpdated = new Date().toISOString();

  const entries = ALL_JOURNAL_SLUGS.map((slug) => {
    const a = JOURNAL_ARTICLES[slug];
    if (a === undefined) return '';
    const url = `${SITE_URL}/aether/journal/${slug}`;
    const updated = isoOrNow(a.publishedOn);
    const html = articleHtml(slug);
    return `
  <entry>
    <id>${xmlEscape(url)}</id>
    <title>${xmlEscape(a.title)}</title>
    <link rel="alternate" type="text/html" href="${xmlEscape(url)}"/>
    <updated>${updated}</updated>
    <published>${updated}</published>
    <author><name>${xmlEscape(a.author)}</name></author>
    <category term="${xmlEscape(a.kicker)}"/>
    <summary>${xmlEscape(a.dek)}</summary>
    <content type="html"><![CDATA[${html}]]></content>
  </entry>`;
  }).join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${xmlEscape(SITE_URL)}/aether/journal</id>
  <title>Aether · The Journal</title>
  <subtitle>Long-form notes from the road. Field notes, craft stories, pilgrim trails.</subtitle>
  <link rel="alternate" type="text/html" href="${xmlEscape(SITE_URL)}/aether/journal"/>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(SITE_URL)}/aether/journal/feed.atom"/>
  <link rel="alternate" type="application/rss+xml" href="${xmlEscape(SITE_URL)}/aether/journal/feed.xml"/>
  <updated>${feedUpdated}</updated>
  <generator uri="${xmlEscape(SITE_URL)}">TravelSuperApp / Aether</generator>
${entries}
</feed>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/atom+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
