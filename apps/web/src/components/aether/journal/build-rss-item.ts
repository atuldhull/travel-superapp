/**
 * AE274 — pure RSS <item> XML builder for the AE53 journal feed.
 *
 * Today the feed builder hand-concatenates the XML. As articles
 * gain richer metadata (categories, author email, GUIDs), keeping
 * a single function source of truth means a wire-shape change
 * lands in one place.
 *
 * Returns the inner <item>…</item> string with content escaped via
 * AE257 escapeAttr. The feed envelope (channel, link, etc.) stays
 * with the caller.
 */
import { escapeAttr } from '../../../lib/escape-attr';
import { articleAbsoluteHref } from './article-href';

export interface RssArticleInputs {
  readonly slug: string;
  readonly title: string;
  readonly publishedOn: string;
  readonly author?: string;
  readonly summary?: string;
  readonly origin: string;
}

function rfc2822(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return new Date(0).toUTCString();
  return d.toUTCString();
}

export function buildRssItem(inputs: RssArticleInputs): string {
  const link = articleAbsoluteHref(inputs.slug, inputs.origin);
  const summary = inputs.summary !== undefined ? escapeAttr(inputs.summary) : '';
  const author = inputs.author !== undefined ? escapeAttr(inputs.author) : '';
  return [
    '<item>',
    `<title>${escapeAttr(inputs.title)}</title>`,
    `<link>${escapeAttr(link)}</link>`,
    `<guid isPermaLink="true">${escapeAttr(link)}</guid>`,
    `<pubDate>${rfc2822(inputs.publishedOn)}</pubDate>`,
    author !== '' ? `<dc:creator>${author}</dc:creator>` : '',
    summary !== '' ? `<description>${summary}</description>` : '',
    '</item>',
  ]
    .filter((s) => s !== '')
    .join('');
}
