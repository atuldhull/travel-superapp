'use client';

/**
 * <AetherA11yStyles> — single shared style block mounted by every
 * Aether shell. Adds visible focus rings to all interactive elements
 * on Aether surfaces (keyboard users currently see only the default
 * browser outline, which we override to nothing in some places).
 *
 * The selector list is broad on purpose — Aether composes with inline
 * styles, so we can't add focus tokens at the design-system level
 * without touching every site.
 *
 * The ring uses a sandstone-orange box-shadow (matches the terracotta
 * palette) so it reads as intentional rather than browser-default.
 * `:focus-visible` keeps mouse clicks from triggering the ring.
 *
 * AE97 — also renders <KeyboardHelp/> so every shell gets the `?`
 * shortcut overlay for free, without needing a separate mount line
 * in every shell file.
 */
import { KeyboardHelp } from './keyboard-help';
const CSS = `
a:focus-visible,
button:focus-visible,
[role='button']:focus-visible,
[role='link']:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px rgba(242, 232, 213, 0.96),
    0 0 0 4px rgba(194, 97, 74, 0.85);
  border-radius: 4px;
  transition: box-shadow 140ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  a:focus-visible,
  button:focus-visible,
  [role='button']:focus-visible,
  [role='link']:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    transition: none;
  }
}
`;

export function AetherA11yStyles(): React.ReactElement {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <KeyboardHelp />
    </>
  );
}
