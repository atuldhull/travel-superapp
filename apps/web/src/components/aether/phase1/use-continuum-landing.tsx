'use client';

/**
 * AE391 — `useContinuumLanding()` React hook.
 *
 * Reads Next's `useSearchParams()` and projects it onto the
 * `ContinuumLanding` shape from `./continuum-landing.ts`. The pure
 * helper does the actual parsing; this file is the thin React adapter.
 *
 * Why useSearchParams (vs window.location.search): App Router serialises
 * `?key=val` strings into a stable Next-managed store so route changes
 * + back/forward replay without manual subscriptions, and SSR returns
 * an empty store rather than throwing.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  NO_CONTINUUM_LANDING,
  readContinuumLanding,
  type ContinuumLanding,
} from './continuum-landing';

/** Read the current pathname's Continuum landing state. Defaults to
 *  `NO_CONTINUUM_LANDING` when search params aren't ready (SSR / before
 *  hydration) so the caller can guard with `landing.isHandoff` without
 *  worrying about null. */
export function useContinuumLanding(): ContinuumLanding {
  const params = useSearchParams();
  return useMemo(() => {
    if (params === null) return NO_CONTINUUM_LANDING;
    return readContinuumLanding(params);
  }, [params]);
}
