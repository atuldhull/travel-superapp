/**
 * AE199 — pure helper for the Atlas `g` keyboard shortcut.
 *
 * Returns true when the key is `g` (lowercase only — capital G is a
 * Shift-modified press that usually means "scroll to bottom" in vim
 * sets, we deliberately don't claim it) AND the focused element is
 * not a form field (avoids hijacking typed `g` in inputs).
 *
 * Same guard family as `shouldFocusFilterOnSlash` (AE144) — kept
 * separate so future shortcut additions are obvious + isolated.
 */
export function shouldGeolocateOnG(
  key: string,
  target: { tagName?: string } | null | undefined,
): boolean {
  if (key !== 'g') return false;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  return true;
}
