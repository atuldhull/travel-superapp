'use client';

/**
 * `<DissolvingLink>` — Next `<Link>` wrapper that triggers the AE382
 * dissolve fade before the route changes.
 *
 * Behaviour:
 *   • Renders Next's `<Link>` so all SSR + prefetch behaviour is preserved.
 *   • Intercepts onClick: if the user-agent would handle the click as a
 *     normal in-app navigation (left button, no modifier keys, no
 *     `target` attribute), call `event.preventDefault()`, fire the
 *     dissolve via `useDissolvingNavigate`, then navigate after
 *     `dissolveMs`.
 *   • Modifier-key clicks (Cmd+click for new tab, etc.) pass through to
 *     Next's default handler with no dissolve.
 *
 * Used in the Phase 1 dev nav to demonstrate the dissolve animation
 * before route change.
 *
 * AE461: the in-app-click classifier moved to `./is-in-app-click` as a
 * pure helper with paired specs; this file only owns the React glue.
 */
import Link from 'next/link';
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { DEFAULT_DISSOLVE_MS, useDissolvingNavigate } from './dissolving-navigate';
import { isInAppClick } from './is-in-app-click';

export { isInAppClick };

export interface DissolvingLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Target route. */
  readonly href: string;
  /** Override dissolve duration (ms). Defaults to AE375/AE382 500ms. */
  readonly dissolveMs?: number;
  /** When true, use `router.replace` instead of `push`. */
  readonly replace?: boolean;
  readonly children?: ReactNode;
}

export function DissolvingLink({
  href,
  dissolveMs = DEFAULT_DISSOLVE_MS,
  replace = false,
  onClick,
  children,
  ...anchorProps
}: DissolvingLinkProps): React.ReactElement {
  const navigate = useDissolvingNavigate(dissolveMs);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (!isInAppClick(event)) return;
    event.preventDefault();
    if (replace) {
      navigate.replace(href);
    } else {
      navigate.push(href);
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...anchorProps}>
      {children}
    </Link>
  );
}
