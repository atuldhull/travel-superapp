/**
 * Post-auth routing helper. Called immediately after a successful
 * sign-in (login / register / OAuth / magic-link consume).
 *
 * Decides the destination by hitting `/auth/me`:
 *   - `hasSeenOnboarding === false` → `/onboarding`
 *   - everything else                → `/home` (the Phase-2 hub) or
 *     the caller-supplied default
 *
 * Failure-tolerant: if the whoami probe fails for any reason, fall
 * back to the default (don't block the user from reaching their
 * trips because of an extra round-trip).
 *
 * The query-string `?tour=true` on /onboarding is the explicit
 * "re-walk the wizard" path — that's a manual link, not part of
 * this helper.
 *
 * Installed by prompt [V.UX.3].
 */
import { authControllerMe } from '@app/sdk';

export interface PostAuthDecision {
  readonly destination: string;
}

export async function decidePostAuthDestination(
  accessToken: string,
  options: { readonly defaultDestination?: string } = {},
): Promise<PostAuthDecision> {
  const fallback = options.defaultDestination ?? '/home';
  try {
    const res = await authControllerMe({
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (res as { data?: unknown }).data as { hasSeenOnboarding?: boolean } | undefined;
    if (body && body.hasSeenOnboarding === false) {
      return { destination: '/onboarding' };
    }
    return { destination: fallback };
  } catch {
    return { destination: fallback };
  }
}

/**
 * Reads a same-origin `?next=` redirect target from the current URL.
 * Rejects absolute and protocol-relative URLs so it can never be used as
 * an open-redirect. Returns null when the param is absent or unsafe.
 *
 * Reads `window.location.search` directly (not the `useSearchParams`
 * hook) so callers can use it inside post-sign-in event handlers without
 * forcing a Suspense boundary on the whole page.
 */
export function safeNextParam(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('next');
  if (raw !== null && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return null;
}
