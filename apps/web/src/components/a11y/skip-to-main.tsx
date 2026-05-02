/**
 * V.UX.28 — first-tab-stop skip link. Hidden until focused, then
 * floats top-left over the header. Tab → Enter jumps the user past
 * the persistent header (Whoami + Inbox + Theme) and into the page
 * content's `<main id="main">` landmark.
 *
 * Pure server-component (no 'use client') so it ships in the initial
 * HTML and the keyboard-only sequence is correct on first paint.
 *
 * Installed by prompt [V.UX.28].
 */
export function SkipToMain() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-foreground"
    >
      Skip to main content
    </a>
  );
}
