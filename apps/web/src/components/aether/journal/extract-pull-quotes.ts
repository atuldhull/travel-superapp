/**
 * AE260 — pure extractor for the pull-quote blocks of a journal
 * article.
 *
 * The article body is `ReadonlyArray<{kind: 'p'|'h2'|'pull', text:string}>`.
 * For OG previews + Storybook stubs + the future "tweet this
 * paragraph" overlay we want only the `pull` blocks. This helper
 * canonicalises the extraction + a "find the strongest one"
 * heuristic (longest pull quote is usually the best preview).
 */

export interface ArticleBlock {
  readonly kind: 'p' | 'h2' | 'pull';
  readonly text: string;
}

export function extractPullQuotes(body: ReadonlyArray<ArticleBlock>): ReadonlyArray<string> {
  return body.filter((b) => b.kind === 'pull').map((b) => b.text);
}

export function strongestPullQuote(body: ReadonlyArray<ArticleBlock>): string | null {
  const quotes = extractPullQuotes(body);
  if (quotes.length === 0) return null;
  let best = quotes[0] ?? '';
  for (const q of quotes) {
    if (q.length > best.length) best = q;
  }
  return best;
}
