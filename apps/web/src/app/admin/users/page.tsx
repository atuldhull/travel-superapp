/**
 * V.UX.36 — admin user moderation queue. Search by displayName,
 * inline ban (with reason) + unban. Each ban / unban writes one
 * row to AdminAuditLog.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band) — presentation only.
 */
'use client';

import { useState } from 'react';
import { Ban, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import {
  getAdminUsersControllerListQueryKey,
  useAdminUsersControllerBan,
  useAdminUsersControllerList,
  useAdminUsersControllerUnban,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

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
      // The generated ban hook omits the request body — orval skips bodies
      // on 204 No-Content operations — so POST it ourselves with the reason
      // (keyed by user id in `reasonByUser`). Without this the API 422s.
      mutationFn: async ({ id }: { id: string }) => {
        const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://127.0.0.1:3000';
        const { getAccessToken } = await import('../../../lib/auth-store');
        const token = getAccessToken();
        const reason = (reasonByUser[id] ?? '').trim();
        const res = await fetch(`${base}/api/v1/admin/users/${id}/ban`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token !== null ? { authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        return { data: undefined, status: 204 as const, headers: res.headers };
      },
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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /trips + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Moderation queue
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Users
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          {total} matching — search, ban with a reason, or restore access.
        </p>
      </header>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by displayName…"
          aria-label="Search users by display name"
          className="w-full rounded-lg border border-gold-600/25 bg-surface py-2 pl-9 pr-3 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
        />
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">No users matched.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-base font-semibold tracking-tight text-surface-foreground">
                  {u.displayName}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Badge variant="gold">{u.role}</Badge>
                  {u.deletedAt ? <Badge variant="danger">deleted</Badge> : null}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                ID <code>{u.id.slice(0, 16)}…</code> · joined{' '}
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={reasonByUser[u.id] ?? ''}
                  onChange={(ev) =>
                    setReasonByUser((prev) => ({ ...prev, [u.id]: ev.target.value }))
                  }
                  placeholder="Ban reason (1..280 chars)"
                  aria-label={`Ban reason for ${u.displayName}`}
                  maxLength={280}
                  className="flex-1 rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
                />
                <Button
                  variant="danger"
                  size="sm"
                  disabled={banMut.isPending || !(reasonByUser[u.id] ?? '').trim()}
                  onClick={() => banMut.mutate({ id: u.id })}
                >
                  <Ban aria-hidden className="h-3.5 w-3.5" /> Ban
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unbanMut.isPending}
                  onClick={() => unbanMut.mutate({ id: u.id })}
                >
                  <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Unban
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
