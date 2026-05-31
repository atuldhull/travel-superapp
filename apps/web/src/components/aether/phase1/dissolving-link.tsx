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
 */
import Link from 'next/link';
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { DEFAULT_DISSOLVE_MS, useDissolvingNavigate } from './dissolving-navigate';

export interface DissolvingLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Target route. */
  readonly href: string;
  /** Override dissolve duration (ms). Defaults to AE375/AE382 500ms. */
  readonly dissolveMs?: number;
  /** When true, use `router.replace` instead of `push`. */
  readonly replace?: boolean;
  readonly children?: ReactNode;
}

/** True iff this click event would default to in-app navigation (no
 *  modifier keys, primary button, no shift/ctrl/meta/alt). */
export function isInAppClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = (event.currentTarget.getAttribute('target') ?? '').toLowerCase();
  if (target !== '' && target !== '_self') return false;
  return true;
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
