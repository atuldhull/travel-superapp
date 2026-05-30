/**
 * AE144 — pure helper for the AE127 `/` keyboard shortcut.
 *
 * Returns true when the keyboard event should focus the Atlas filter
 * input: key is exactly `/` AND the active focus is NOT already inside
 * a form field. Extracted so the (otherwise simple) gate can be
 * unit-tested without spinning up the entire Atlas surface.
 */
export function shouldFocusFilterOnSlash(
  key: string,
  target: { tagName?: string } | null | undefined,
): boolean {
  if (key !== '/') return false;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  return true;
}
