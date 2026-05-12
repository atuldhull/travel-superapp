/**
 * V.UX.36 — admin media takedown queue. Cross-user list + hard
 * delete for abusive content. Each delete writes one row to
 * AdminAuditLog (V.UX.36 retrofit on `AdminDeleteMediaUseCase`).
 */
'use client';

import { useState } from 'react';
import {
  getAdminMediaControllerListQueryKey,
  useAdminMediaControllerList,
  useAdminMediaControllerRemove,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
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
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Media takedown</h1>
        <p className="text-sm text-muted">{total} matching assets.</p>
      </header>

      <input
        type="text"
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
        placeholder="Filter by owner user-id (cuid)"
        className="w-full rounded border border-muted/15 bg-surface px-3 py-2 text-sm"
      />

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-muted/15 p-3 text-sm text-muted">
          No media in scope.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="rounded-md border border-muted/15 bg-surface p-3 text-sm">
              <div className="flex gap-3">
                <Thumbnail
                  src={m.thumbDownloadUrl ?? null}
                  alt={`${m.kind} ${m.id}`}
                  kind={m.kind}
                  size={64}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {m.kind} · {m.status}
                      {m.variants && m.variants.length > 0 ? (
                        <span className="ml-2 text-[10px] font-normal text-muted">
                          ({m.variants.length} variant{m.variants.length === 1 ? '' : 's'})
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
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
                      className="rounded-md border border-rose-500 bg-rose-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Takedown
                    </button>
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
    </div>
  );
}
