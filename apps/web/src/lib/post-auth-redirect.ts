/**
 * Post-auth routing helper. Called immediately after a successful
 * sign-in (login / register / OAuth / magic-link consume).
 *
 * Decides the destination by hitting `/auth/me`:
 *   - `hasSeenOnboarding === false` → `/onboarding`
 *   - everything else                → `/trips` (or the caller-supplied default)
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
  const fallback = options.defaultDestination ?? '/trips';
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
