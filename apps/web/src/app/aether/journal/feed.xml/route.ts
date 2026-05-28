/**
 * /aether/journal/feed.xml — RSS 2.0 feed of Aether journal articles.
 *
 * Phase 0 publishes the 6 long-form pieces stored in journal/data.ts.
 * Even though the Aether routes are noindex via robots, the RSS feed
 * is still a useful artefact: readers using NetNewsWire / Feedly /
 * Inoreader can subscribe; partner publications (Lonely Planet etc.)
 * can consume it.
 *
 * Env-gated identical to every other Aether route — returns 404 when
 * NEXT_PUBLIC_FEATURE_AETHER_PREVIEW != '1'.
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
  // Render the body paragraphs as simple HTML. Pull-quotes get a
  // blockquote treatment so RSS readers that respect <blockquote>
  // still get the editorial pacing.
  return a.body
    .map((block) => {
      if (block.kind === 'h2') return `<h2>${xmlEscape(block.text)}</h2>`;
      if (block.kind === 'pull') return `<blockquote>${xmlEscape(block.text)}</blockquote>`;
      return `<p>${xmlEscape(block.text)}</p>`;
    })
    .join('\n');
}

export async function GET(): Promise<Response> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }

  const buildDate = new Date().toUTCString();
  const items = ALL_JOURNAL_SLUGS.map((slug) => {
    const a = JOURNAL_ARTICLES[slug];
    if (a === undefined) return '';
    const url = `${SITE_URL}/aether/journal/${slug}`;
    const pubDate = new Date(a.publishedOn).toUTCString();
    return `
    <item>
      <title>${xmlEscape(a.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>aether@travelsuperapp.local (${xmlEscape(a.author)})</author>
      <category>${xmlEscape(a.kicker)}</category>
      <description>${xmlEscape(a.dek)}</description>
      <content:encoded><![CDATA[${articleHtml(slug)}]]></content:encoded>
    </item>`;
  }).join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Aether · The Journal</title>
    <link>${xmlEscape(SITE_URL)}/aether/journal</link>
    <atom:link href="${xmlEscape(SITE_URL)}/aether/journal/feed.xml" rel="self" type="application/rss+xml" />
    <description>Long-form notes from the road. Field notes, craft stories, pilgrim trails.</description>
    <language>en-IN</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <generator>TravelSuperApp / Aether</generator>
${items}
  </channel>
</rss>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // 1h cache — same posture as the existing sitemap.
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
