/**
 * Phase 5 (J2) — `/users/[id]/following`. Thin route wrapper around
 * the shared <ConnectionList>.
 *
 * Installed by prompt [J2].
 */
'use client';

import { useParams } from 'next/navigation';
import { ConnectionList } from '../../../../components/social/connection-list';

export default function FollowingPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  return <ConnectionList userId={userId} kind="following" />;
}
