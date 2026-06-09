/**
 * Phase 5 (J2) — `/users/[id]/following`. Thin route wrapper around
 * the shared <ConnectionList>.
 *
 * Installed by prompt [J2].
 */
'use client';

import type { Route } from 'next';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConnectionList } from '../../../../components/social/connection-list';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

export default function FollowingPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const router = useRouter();

  // The followers/following endpoints require auth; bounce a signed-out
  // visitor (direct link / lapsed session) to sign-in with a return path
  // once silent-refresh has settled, instead of a generic load error.
  useEffect(() => {
    if (bootComplete && token === null) {
      router.replace(`/login?next=/users/${userId}/following` as Route);
    }
  }, [bootComplete, token, userId, router]);

  if (bootComplete && token === null) return null;
  return <ConnectionList userId={userId} kind="following" />;
}
