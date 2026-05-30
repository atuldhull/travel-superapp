/**
 * AE288 — pure light markdown → plain text stripper.
 *
 * For RSS <description>, share-card subtitles, and "preview the
 * plan in plain text" surfaces. Strips:
 *   - **bold**   / __bold__
 *   - *italic*   / _italic_
 *   - `code`
 *   - # heading marks
 *   - - list bullets
 *   - [link](url) → link text only
 *
 * Does NOT parse a full markdown AST. Good enough for one-paragraph
 * planner output + journal pull quotes.
 */

export function stripMarkdown(input: string): string {
  if (input === '') return '';
  let out = input;
  // Code spans first so backticks inside other patterns don't bleed.
  out = out.replace(/`([^`]*)`/g, '$1');
  // Links: [text](url) → text
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Bold / italic — order matters, do bold first.
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/__([^_]+)__/g, '$1');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  out = out.replace(/(?<!_)_([^_]+)_(?!_)/g, '$1');
  // Heading marks at start of line.
  out = out.replace(/^#{1,6}\s+/gm, '');
  // Bullet markers at start of line ('- ' or '* ' or '+ ').
  out = out.replace(/^[-*+]\s+/gm, '');
  return out;
}
