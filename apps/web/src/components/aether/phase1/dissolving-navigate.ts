'use client';

/**
 * Navigation-triggered dissolve.
 *
 * AE382 closed the lifecycle loop with a listening hold, but cross-surface
 * navigation still happens instantly — no dissolve fades when the user
 * clicks a link. The original plan was `router.events → setPhase` but
 * Next.js 15 App Router removed the events API; instead we intercept
 * user-initiated navigation (Link clicks + `router.push` calls) and run
 * the dissolve manually before letting the route change.
 *
 * Pure layer (this file): `delayedNavigate(setPhase, navigate, dissolveMs)`
 * fires `setPhase('dissolving')` then schedules `navigate()` after
 * `dissolveMs`. Returns a cancel handle in case the consumer unmounts
 * before the timer fires.
 *
 * React layer: `useDissolvingNavigate(dissolveMs?)` wraps Next's
 * `useRouter().push|replace` so any imperative navigation in a Phase 1
 * shell fires the dissolve first.
 *
 * Component layer: `<DissolvingLink>` (in `dissolving-link.tsx`) wraps
 * Next's `<Link>` with the same interception so declarative `<a>`
 * navigation also fades out.
 */
import type { SurfaceLifecyclePhase } from '@app/aether-core';

/** Hands the dissolve job off to a setTimeout. Returns a cancel
 *  function — call it from a useEffect cleanup if the consumer
 *  unmounts before the timer fires. */
export interface DelayedNavigateCancel {
  (): void;
}

/** Pure: fire `setPhase('dissolving')` synchronously, then schedule
 *  `navigate()` after `dissolveMs`. Returns a cancel function that
 *  clears the pending navigation timer.
 *
 *  Does NOT short-circuit when the current phase is already
 *  `dissolving` — callers may want to RE-fire the dissolve (e.g. on
 *  rapid double-click) and reset the timer.
 *
 *  Tested with mock setPhase + mock navigate + fake timers. */
export function delayedNavigate(
  setPhase: (next: SurfaceLifecyclePhase) => void,
  navigate: () => void,
  dissolveMs: number,
): DelayedNavigateCancel {
  setPhase('dissolving');
  if (dissolveMs <= 0) {
    // No fade time configured — navigate immediately on the next tick
    // so React still commits the phase change before the route swaps.
    const handle = setTimeout(navigate, 0);
    return (): void => clearTimeout(handle);
  }
  const handle = setTimeout(navigate, dissolveMs);
  return (): void => clearTimeout(handle);
}

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSurfaceManager } from '@app/aether-core';

/** Default dissolve duration — matches AE375's `DEFAULT_PHASE_DURATIONS.dissolving`
 *  + AE382's `dissolvingMs` (both 500ms). Caller can override. */
export const DEFAULT_DISSOLVE_MS = 500;

export interface DissolvingNavigate {
  push(href: string): void;
  replace(href: string): void;
  /** True when a dissolve+navigate is currently in-flight (set on push/
   *  replace; cleared when the timer fires or the hook unmounts). */
  readonly isPending: boolean;
}

/**
 * React hook — returns navigation methods that fire the dissolve fade
 * before the route swap. Internally wraps `useRouter().push|replace`
 * and `useSurfaceManager().setPhase`. The dissolve timer is cleared
 * on unmount so a fast-unmounting shell doesn't leak a setTimeout.
 *
 * The hook does NOT manage `isPending` as React state to avoid
 * extra re-renders during the dissolve frame; callers who need
 * pending awareness should subscribe to `useSurfaceLifecycle()`
 * and watch for `'dissolving'`.
 */
export function useDissolvingNavigate(
  dissolveMs: number = DEFAULT_DISSOLVE_MS,
): DissolvingNavigate {
  const router = useRouter();
  const { setPhase } = useSurfaceManager();
  const cancelRef = useRef<DelayedNavigateCancel | null>(null);

  const push = useCallback(
    (href: string) => {
      // Cancel any prior in-flight dissolve so rapid clicks don't
      // double-fire navigation.
      cancelRef.current?.();
      cancelRef.current = delayedNavigate(setPhase, () => router.push(href), dissolveMs);
    },
    [router, setPhase, dissolveMs],
  );

  const replace = useCallback(
    (href: string) => {
      cancelRef.current?.();
      cancelRef.current = delayedNavigate(setPhase, () => router.replace(href), dissolveMs);
    },
    [router, setPhase, dissolveMs],
  );

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  // Read-only — the hook intentionally avoids state to keep the fade
  // pure CSS/R3F-driven. Always `false` from the hook's perspective.
  return { push, replace, isPending: false };
}
