/**
 * AE278 — pure domain extractor from a URL string.
 *
 * Used for:
 *   - Pulse 'share via X' chips that show the destination domain
 *     ("on twitter.com") next to the icon
 *   - paste detection: if the user pastes a fathom.video URL, the
 *     bridge knows to offer 'summarise this meeting'
 *
 * Returns the hostname stripped of "www." prefix, or null for
 * invalid / non-URL input.
 */

export function extractDomain(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  try {
    const url = new URL(trimmed);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host === '' ? null : host;
  } catch {
    return null;
  }
}
