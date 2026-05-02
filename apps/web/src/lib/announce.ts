/**
 * V.UX.28 — global ARIA live-region helper.
 *
 * The pattern: a single `aria-live="polite"` div lives in the root
 * layout. Async actions (save, delete, archive) call
 * `announce('Trip saved')` to push a string into that region; screen
 * readers (NVDA, VoiceOver, JAWS) read it without stealing keyboard
 * focus. Politeness is intentional — `assertive` is reserved for
 * blocking errors so the user isn't interrupted mid-sentence.
 *
 * Two flavours:
 *   - `announce(msg)` — polite (default). Use for confirmations,
 *     completions, and status changes ("Itinerary saved", "5 items
 *     archived").
 *   - `announce(msg, 'assertive')` — interrupting. Use only for
 *     blocking errors the user MUST hear right now ("Sign-in failed,
 *     check your password", "Trip not found").
 *
 * Server-render safe: a no-op when `document` is undefined. The
 * region itself is added by the root layout's `<LiveRegion />`
 * component, mounted once.
 *
 * Installed by prompt [V.UX.28].
 */

const POLITE_ID = 'a11y-live-polite';
const ASSERTIVE_ID = 'a11y-live-assertive';

export type Politeness = 'polite' | 'assertive';

export function announce(message: string, politeness: Politeness = 'polite'): void {
  if (typeof document === 'undefined') return;
  const id = politeness === 'assertive' ? ASSERTIVE_ID : POLITE_ID;
  const region = document.getElementById(id);
  if (!region) return;
  // Clear-then-set forces re-announcement when the same string is
  // sent twice in a row (e.g. "Saved" after a quick second save).
  // Without the clear, the live region debounces identical content.
  region.textContent = '';
  // Defer one tick so the screen reader notices the diff.
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}
