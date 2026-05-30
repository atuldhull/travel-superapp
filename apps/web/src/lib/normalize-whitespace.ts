/**
 * AE291 — pure whitespace normaliser.
 *
 * Collapses runs of whitespace (incl. newlines) to a single space
 * and trims leading/trailing whitespace. Used by AE220
 * buildArticleMetaLine + future OG/share message generators where
 * "title\n\nfrom    body" should render as "title from body".
 */

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}
