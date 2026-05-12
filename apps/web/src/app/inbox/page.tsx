/**
 * V.UX.26 — notification inbox + per-category prefs + Web Push
 * subscribe button. Auth-required (the `/notifications/me` route is
 * `@ApiBearerAuth`).
 *
 * Three sections:
 *   1. Browser-push enable button (shows once when permission isn't
 *      granted; calls `ensureWebPushSubscription`).
 *   2. Per-category opt-out checkboxes (PATCH /notifications/preferences).
 *   3. Inbox list — newest first, swipe-to-archive + hard-delete.
 *
 * Installed by prompt [V.UX.26].
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  getNotificationsControllerListMineQueryKey,
  useNotificationPreferencesControllerGetMine,
  useNotificationPreferencesControllerUpdateMine,
  useNotificationsControllerArchive,
  useNotificationsControllerListMine,
  useNotificationsControllerMarkRead,
  useNotificationsControllerRemove,
  type NotificationLogDto,
  type NotificationPreferencesDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Skeleton, SkeletonList } from '../../components/ui/skeleton';
import { toast } from '../../components/ui/toast';
import { NotificationRow } from '../../components/inbox/notification-row';
import { useAuthToken } from '../../lib/use-auth-token';
import {
  ensureWebPushSubscription,
  type WebPushSubscribeResult,
} from '../../lib/web-push-subscribe';

const CATEGORIES = [
  { key: 'trip', label: 'Trip updates (lock, itinerary ready)' },
  { key: 'safety', label: 'Safety alerts (SOS acknowledged, scams)' },
  { key: 'social', label: 'Social (review responses, votes, helpful)' },
  { key: 'digest', label: 'Weekly digest (Sunday morning summary)' },
  { key: 'account', label: 'Account (sign-in, magic link)' },
] as const;

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface NotificationPayload {
  subject?: string;
  body?: string;
  context?: { url?: string };
}

export default function InboxPage() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();

  const list = useNotificationsControllerListMine({ limit: '100' } as never, {
    query: { enabled: token !== null, retry: false },
  });
  const prefs = useNotificationPreferencesControllerGetMine({
    query: { enabled: token !== null, retry: false },
  });
  const updatePrefs = useNotificationPreferencesControllerUpdateMine();
  const archive = useNotificationsControllerArchive();
  const remove = useNotificationsControllerRemove();
  const markRead = useNotificationsControllerMarkRead();

  const listKey = useMemo(
    () => getNotificationsControllerListMineQueryKey({ limit: '100' } as never),
    [],
  );

  const [pushResult, setPushResult] = useState<WebPushSubscribeResult | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrMsg(null);
  }, [list.dataUpdatedAt]);

  const items = list.data?.data as { notifications: NotificationLogDto[] } | undefined;
  const prefsBody = prefs.data?.data as NotificationPreferencesDto | undefined;

  if (token === null) {
    return (
      <main>
        <Card>
          <p className="text-sm text-muted">Sign in to see your inbox.</p>
        </Card>
      </main>
    );
  }

  async function refreshList() {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }

  async function handleEnablePush() {
    setPushBusy(true);
    try {
      const r = await ensureWebPushSubscription();
      setPushResult(r);
    } finally {
      setPushBusy(false);
    }
  }

  async function handleArchive(id: string) {
    setActiveArchiveId(id);
    try {
      await archive.mutateAsync({ id });
      await refreshList();
      toast.success('Notification archived');
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Archive failed.'}`);
      toast.error(`Archive failed: ${e.message ?? 'Try again.'}`);
    } finally {
      setActiveArchiveId(null);
    }
  }

  async function handleDelete(id: string) {
    setActiveDeleteId(id);
    try {
      await remove.mutateAsync({ id });
      await refreshList();
      toast.success('Notification deleted');
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Delete failed.'}`);
      toast.error(`Delete failed: ${e.message ?? 'Try again.'}`);
    } finally {
      setActiveDeleteId(null);
    }
  }

  async function handleOpen(row: NotificationLogDto) {
    const payload = (row.payload ?? {}) as NotificationPayload;
    const url = payload.context?.url ?? null;
    if (!row.read) {
      try {
        await markRead.mutateAsync({ id: row.id });
        await refreshList();
      } catch {
        /* swallow — navigation still proceeds */
      }
    }
    if (url) router.push(url as never);
  }

  async function toggleCategory(category: string, currentlyDisabled: string[], next: boolean) {
    const set = new Set(currentlyDisabled);
    if (next) set.delete(category);
    else set.add(category);
    try {
      await updatePrefs.mutateAsync({
        data: { categoriesDisabled: [...set] as never },
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/v1/notifications/preferences'] });
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save preferences failed.'}`,
      );
    }
  }

  async function toggleChannel(field: 'push' | 'email' | 'sms', next: boolean) {
    try {
      await updatePrefs.mutateAsync({
        data: { [field]: next } as never,
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/v1/notifications/preferences'] });
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save preferences failed.'}`,
      );
    }
  }

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardSubtitle>
            Your notifications, newest first. Swipe-to-archive trims the list; delete is permanent.
          </CardSubtitle>
        </CardHeader>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="rounded-md border border-brand/40 px-3 py-1.5 text-xs hover:bg-brand/10 disabled:opacity-50"
          >
            🔔 Enable browser push
          </button>
          {pushResult ? (
            <span className="ml-3 text-xs text-muted">{renderPushResult(pushResult)}</span>
          ) : null}
        </div>
        {errMsg ? <p className="mt-2 text-xs text-danger">{errMsg}</p> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardSubtitle>Channel + category opt-out. Saved instantly.</CardSubtitle>
        </CardHeader>
        {prefs.isLoading || !prefsBody ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="mt-3 space-y-4 text-sm">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase text-muted">Channels</legend>
              {(['push', 'email', 'sms'] as const).map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefsBody[c]}
                    onChange={(e) => void toggleChannel(c, e.target.checked)}
                  />
                  <span className="capitalize">{c}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase text-muted">Categories</legend>
              {CATEGORIES.map((cat) => {
                const enabled = !prefsBody.categoriesDisabled.includes(cat.key);
                return (
                  <label key={cat.key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        void toggleCategory(cat.key, prefsBody.categoriesDisabled, e.target.checked)
                      }
                      className="mt-1"
                    />
                    <span>{cat.label}</span>
                  </label>
                );
              })}
            </fieldset>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
          <CardSubtitle>Tap a row to mark read + open the linked surface.</CardSubtitle>
        </CardHeader>
        {list.isLoading ? (
          <SkeletonList rows={4} />
        ) : list.isError ? (
          <p className="text-sm text-danger">Couldn&apos;t load inbox.</p>
        ) : items && items.notifications.length > 0 ? (
          <ul className="space-y-2">
            {items.notifications.map((n) => {
              const payload = (n.payload ?? {}) as NotificationPayload;
              return (
                <NotificationRow
                  key={n.id}
                  id={n.id}
                  templateId={n.templateId}
                  status={n.status}
                  read={n.read}
                  archivedAt={n.archivedAt as unknown as string | null}
                  createdAt={n.createdAt}
                  subject={payload.subject ?? null}
                  body={payload.body ?? null}
                  url={payload.context?.url ?? null}
                  archiving={activeArchiveId === n.id}
                  deleting={activeDeleteId === n.id}
                  onOpen={() => void handleOpen(n)}
                  onArchive={() => void handleArchive(n.id)}
                  onDelete={() => void handleDelete(n.id)}
                />
              );
            })}
          </ul>
        ) : (
          <EmptyState
            emoji="📭"
            title="Inbox empty"
            body="When something needs your attention — a trip lock, a shared itinerary, an SOS update — it'll show up here."
          />
        )}
      </Card>
    </main>
  );
}

function renderPushResult(r: WebPushSubscribeResult): string {
  switch (r.kind) {
    case 'subscribed':
      return '✅ Subscribed for push.';
    case 'unsupported':
      return 'This browser doesn’t support Web Push.';
    case 'denied':
      return 'Permission denied — update browser settings to re-enable.';
    case 'no-vapid':
      return 'Push isn’t configured in this environment yet.';
    case 'error':
      return `Couldn’t subscribe: ${r.message}`;
  }
}
