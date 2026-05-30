/**
 * AE220 — pure builder for the journal-article meta line.
 *
 * The article header surfaces three facts (author / read time /
 * publish date) joined by middle-dots. The component renders the
 * segments individually so each can be a separate <span> with its
 * own aria-hidden middle-dot — but for RSS, OG previews, and the
 * planned 'Send to Pulse' summary, we also need a single joined
 * string. This helper returns BOTH the segment list (for the React
 * render) and the joined string (for non-React surfaces).
 *
 * Empty segments are dropped so a missing author / 0-min read
 * doesn't leave a dangling separator.
 */

export interface ArticleMetaInputs {
  readonly author: string;
  readonly readMins: number;
  readonly publishedOn: string;
}

export interface ArticleMeta {
  readonly segments: ReadonlyArray<string>;
  readonly joined: string;
}

const SEP = ' · ';

export function buildArticleMetaLine(inputs: ArticleMetaInputs): ArticleMeta {
  const segments: string[] = [];
  if (inputs.author.trim() !== '') segments.push(`By ${inputs.author.trim()}`);
  if (inputs.readMins > 0) segments.push(`${inputs.readMins} min read`);
  if (inputs.publishedOn.trim() !== '') segments.push(inputs.publishedOn.trim());
  return { segments, joined: segments.join(SEP) };
}
