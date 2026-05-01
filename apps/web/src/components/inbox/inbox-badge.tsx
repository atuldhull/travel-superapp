/**
 * V.UX.26 — header inbox badge. Polls `/notifications/me/unread-count`
 * via the typed sdk hook + renders a 📬 link to `/inbox` with the
 * unread count when non-zero. Auto-omitted for anonymous viewers.
 *
 * Installed by prompt [V.UX.26].
 */
'use client';

import Link from 'next/link';
import { useNotificationsControllerUnreadCount } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

interface UnreadBody {
  unread: number;
}

export function InboxBadge() {
  const token = useAuthToken();
  const { data } = useNotificationsControllerUnreadCount({
    query: { enabled: token !== null, retry: false, refetchInterval: 60_000 },
  });
  if (token === null) return null;
  const count = (data?.data as unknown as UnreadBody | undefined)?.unread ?? 0;
  return (
    <Link
      href={'/inbox' as never}
      className="relative inline-flex items-center gap-1 rounded-md border border-muted/30 px-2 py-1 text-xs hover:bg-muted/10"
      aria-label={count === 0 ? 'Inbox' : `Inbox (${count} unread)`}
    >
      <span aria-hidden>📬</span>
      <span>Inbox</span>
      {count > 0 ? (
        <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
