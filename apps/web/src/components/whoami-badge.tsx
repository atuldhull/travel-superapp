/**
 * Whoami badge — renders nothing when signed out; renders a small
 * pill with the role + truncated user id when signed in. Uses the
 * typed `useAuthControllerMe` hook so the response shape stays in
 * sync with `WhoAmIResponseDto` from the api.
 *
 * The query is gated on `useAuthToken()` so a signed-out tab never
 * fires `/auth/me` at all (no spurious 401 in dev tools).
 *
 * Installed by prompt [IV.18.19.30].
 */
'use client';

import { useAuthControllerMe, type WhoAmIResponseDto } from '@app/sdk';
import { Badge } from './ui/badge';
import { useAuthToken } from '../lib/use-auth-token';

export function WhoAmIBadge() {
  const token = useAuthToken();
  const { data, isLoading, isError } = useAuthControllerMe({
    query: { enabled: token !== null },
  });

  if (token === null || isError) return null;
  if (isLoading) {
    return (
      <span className="text-xs text-muted" aria-live="polite">
        Loading…
      </span>
    );
  }
  const me = data as unknown as WhoAmIResponseDto | undefined;
  if (!me) return null;

  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      Signed in as <Badge variant="brand">{me.role}</Badge>
      <code className="rounded bg-muted/10 px-1 py-0.5 font-mono text-[10px]">
        {me.sub.slice(0, 8)}…
      </code>
    </span>
  );
}
