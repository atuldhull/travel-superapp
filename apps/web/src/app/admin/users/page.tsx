/**
 * V.UX.36 — admin user moderation queue. Search by displayName,
 * inline ban (with reason) + unban. Each ban / unban writes one
 * row to AdminAuditLog.
 */
'use client';

import { useState } from 'react';
import {
  getAdminUsersControllerListQueryKey,
  useAdminUsersControllerBan,
  useAdminUsersControllerList,
  useAdminUsersControllerUnban,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';

interface AdminUser {
  readonly id: string;
  readonly emailHash: string;
  readonly displayName: string;
  readonly role: string;
  readonly mfaEnabled: boolean;
  readonly createdAt: string;
  readonly deletedAt: string | null;
}

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [reasonByUser, setReasonByUser] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const queryParams = (q.trim() ? { q: q.trim() } : {}) as never;
  const list = useAdminUsersControllerList(queryParams);
  const users =
    (list.data?.data as { users?: AdminUser[]; total?: number } | undefined)?.users ?? [];
  const total = (list.data?.data as { total?: number } | undefined)?.total ?? 0;

  const banMut = useAdminUsersControllerBan({
    mutation: {
      onSuccess: (_d: unknown, vars: { id: string }) => {
        setReasonByUser((prev) => {
          const { [vars.id]: _drop, ...rest } = prev;
          return rest;
        });
        void qc.invalidateQueries({
          queryKey: getAdminUsersControllerListQueryKey(queryParams),
        });
      },
    },
  });
  const unbanMut = useAdminUsersControllerUnban({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: getAdminUsersControllerListQueryKey(queryParams),
        });
      },
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted">{total} matching.</p>
      </header>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by displayName…"
        className="w-full rounded border border-muted/15 bg-surface px-3 py-2 text-sm"
      />

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="rounded-md border border-muted/15 p-3 text-sm text-muted">
          No users matched.
        </p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-md border border-muted/15 bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{u.displayName}</span>
                <span className="text-xs uppercase tracking-wide text-muted">
                  {u.role}
                  {u.deletedAt ? ' · deleted' : ''}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                ID <code>{u.id.slice(0, 16)}…</code> · joined{' '}
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={reasonByUser[u.id] ?? ''}
                  onChange={(ev) =>
                    setReasonByUser((prev) => ({ ...prev, [u.id]: ev.target.value }))
                  }
                  placeholder="Ban reason (1..280 chars)"
                  maxLength={280}
                  className="flex-1 rounded border border-muted/15 bg-surface px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={banMut.isPending || !(reasonByUser[u.id] ?? '').trim()}
                  onClick={() =>
                    banMut.mutate({
                      id: u.id,
                      data: { reason: (reasonByUser[u.id] ?? '').trim() },
                    })
                  }
                  className="rounded-md border border-rose-500 bg-rose-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Ban
                </button>
                <button
                  type="button"
                  disabled={unbanMut.isPending}
                  onClick={() => unbanMut.mutate({ id: u.id })}
                  className="rounded-md border border-emerald-600 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  Unban
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
