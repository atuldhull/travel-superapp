/**
 * AE279 — pure share-message formatter for WhatsApp / X intents.
 *
 * The journey dashboard's share button could open a deep link
 * with a pre-filled message; this helper canonicalises the format:
 *
 *   "<title>\n<tagline>\n<url>"
 *
 * Drops empty segments so a draft-title share never has a dangling
 * newline. Truncates the tagline at 240 chars to keep the X intent
 * URL under the path limit.
 */

export const SHARE_TAGLINE_MAX = 240;

export interface ShareMessageInputs {
  readonly title: string;
  readonly tagline?: string;
  readonly url: string;
}

function clipTagline(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length <= SHARE_TAGLINE_MAX) return trimmed;
  return `${trimmed.slice(0, SHARE_TAGLINE_MAX - 1).trimEnd()}…`;
}

export function buildShareMessage(inputs: ShareMessageInputs): string {
  const lines: string[] = [];
  const title = inputs.title.trim();
  if (title !== '') lines.push(title);
  if (inputs.tagline !== undefined) {
    const clipped = clipTagline(inputs.tagline);
    if (clipped !== '') lines.push(clipped);
  }
  const url = inputs.url.trim();
  if (url !== '') lines.push(url);
  return lines.join('\n');
}
