/**
 * V.UX.36 — admin media takedown queue. Cross-user list + hard
 * delete for abusive content. Each delete writes one row to
 * AdminAuditLog (V.UX.36 retrofit on `AdminDeleteMediaUseCase`).
 */
'use client';

import { useState } from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import {
  getAdminMediaControllerListQueryKey,
  useAdminMediaControllerList,
  useAdminMediaControllerRemove,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Thumbnail } from '../../../components/media/thumbnail';

interface AdminMediaVariant {
  readonly label: string;
  readonly format: string;
  readonly s3Key: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

interface AdminMedia {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: string;
  readonly status: string;
  readonly s3KeyRaw: string;
  readonly createdAt: string;
  /** POST.5 — Sharp-generated alternates ([] for legacy / video). */
  readonly variants?: readonly AdminMediaVariant[];
  /** POST.5 — short-TTL presigned URL for the thumb variant. */
  readonly thumbDownloadUrl?: string | null;
}

export default function AdminMediaPage() {
  const [ownerId, setOwnerId] = useState('');
  const qc = useQueryClient();

  const queryParams = (ownerId.trim() ? { ownerId: ownerId.trim() } : {}) as never;
  const list = useAdminMediaControllerList(queryParams);
  const items =
    (list.data?.data as { media?: AdminMedia[]; total?: number } | undefined)?.media ?? [];
  const total = (list.data?.data as { total?: number } | undefined)?.total ?? 0;

  const removeMut = useAdminMediaControllerRemove({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({
          queryKey: getAdminMediaControllerListQueryKey(queryParams),
        });
      },
    },
  });

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Moderation
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Media takedown
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          {total} matching assets. Hard-delete abusive content across users — each removal writes
          one audit-log row and is irreversible.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Filter</CardTitle>
          <CardSubtitle>Scope the queue to a single owner by user-id.</CardSubtitle>
        </CardHeader>
        <input
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="Filter by owner user-id (cuid)"
          className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
        />
      </Card>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <Card depth="flat" className="p-5">
          <p className="text-sm text-muted">No media in scope.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className="flex gap-3">
                <Thumbnail
                  src={m.thumbDownloadUrl ?? null}
                  alt={`${m.kind} ${m.id}`}
                  kind={m.kind}
                  size={64}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-surface-foreground">
                      {m.kind} · {m.status}
                      {m.variants && m.variants.length > 0 ? (
                        <Badge variant="gold">
                          {m.variants.length} variant{m.variants.length === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={removeMut.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Hard-delete this media? Trip + memory book references SetNull-cascade. This is irreversible.',
                          )
                        ) {
                          removeMut.mutate({ id: m.id });
                        }
                      }}
                    >
                      <Trash2 aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Takedown
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Owner <code>{m.ownerId.slice(0, 12)}…</code>
                    {m.tripId ? ` · trip ${m.tripId.slice(0, 12)}…` : null} · uploaded{' '}
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted">{m.s3KeyRaw}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
