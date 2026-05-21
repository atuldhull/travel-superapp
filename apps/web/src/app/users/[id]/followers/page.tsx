/**
 * Phase 5 (J2) — `/users/[id]/followers`. Thin route wrapper around
 * the shared <ConnectionList>. The list is block-filtered server-side
 * against the signed-in viewer.
 *
 * Installed by prompt [J2].
 */
'use client';

import { useParams } from 'next/navigation';
import { ConnectionList } from '../../../../components/social/connection-list';

export default function FollowersPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  return <ConnectionList userId={userId} kind="followers" />;
}
