/**
 * AE461 — pure helper extracted from `<DissolvingLink>`.
 *
 * `isInAppClick(event)` returns `true` iff the click on an anchor would
 * default to in-app navigation, i.e. the user-agent would NOT open the
 * link in a new tab / window / app.
 *
 * Rules (all must hold for `true`):
 *   1. `event.defaultPrevented` is false — Next `<Link>` already
 *      cancels in some cases; if it has, we yield.
 *   2. Primary mouse button only (`event.button === 0`). Middle-click
 *      (button=1, open-in-tab) and right-click (button=2, context menu)
 *      both return false.
 *   3. No Cmd / Ctrl / Shift / Alt modifier keys (those open in a new
 *      tab / window / download).
 *   4. The anchor has no `target` attribute, or its target is `_self`.
 *      Any other target (`_blank`, `_top`, `_parent`, a named frame)
 *      returns false.
 *
 * Pure / side-effect-free. Reads only `defaultPrevented`, `button`,
 * the four modifier flags, and `currentTarget.getAttribute('target')`.
 */
import { type MouseEvent } from 'react';

/** True iff this click event would default to in-app navigation. */
export function isInAppClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = (event.currentTarget.getAttribute('target') ?? '').toLowerCase();
  if (target !== '' && target !== '_self') return false;
  return true;
}
