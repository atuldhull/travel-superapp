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
import { Bell } from 'lucide-react';
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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <Bell aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            Sign in to see your inbox
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Trip locks, shared itineraries, and safety updates land here.
          </p>
        </div>
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
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-10 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Bell aria-hidden className="h-3.5 w-3.5" /> Inbox
        </p>
        <h1 className="relative mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          What needs your attention
        </h1>
        <p className="relative mt-2 max-w-md text-sm text-white/65">
          Notifications newest first. Swipe-to-archive trims the list; delete is permanent.
        </p>
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gold-200 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Bell aria-hidden className="h-3.5 w-3.5" /> Enable browser push
          </button>
          {pushResult ? (
            <span className="text-xs text-white/65">{renderPushResult(pushResult)}</span>
          ) : null}
        </div>
        {errMsg ? <p className="relative mt-2 text-xs text-red-300">{errMsg}</p> : null}
      </header>

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
          <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load inbox.</p>
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
