/**
 * AE264 — pure share-code extractor from a share URL.
 *
 * Inverse of AE218 buildShareUrl. Used when:
 *   - the user pastes a share link into Pulse to ask 'what's this?'
 *   - the AE43 /me/shares row offers 'open shared view' from a
 *     stored full URL
 *   - the planned Pulse-from-share-link import slice
 *
 * Accepts both `/shared/<code>` and `/aether/shared/<code>` paths
 * (the AE218 'legacy' and 'aether' surfaces). Returns the decoded
 * code or null for any non-matching URL.
 */

const SHARE_PATH = /\/(?:aether\/)?shared\/([^/?#]+)/;

export function extractShareCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const match = SHARE_PATH.exec(trimmed);
  if (match === null) return null;
  const raw = match[1] ?? '';
  if (raw === '') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
