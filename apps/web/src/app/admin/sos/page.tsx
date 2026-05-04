/**
 * V.UX.36 — admin SOS triage queue. Lists active SOS events +
 * inline "Resolve" with optional note. Each resolve emits an
 * audit row server-side (V.UX.36 retrofit on `AdminResolveSosUseCase`).
 */
'use client';

import { useState } from 'react';
import {
  getAdminSosControllerListQueryKey,
  useAdminSosControllerList,
  useAdminSosControllerResolve,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';

interface SosEvent {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
}

export default function AdminSosTriagePage() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | ''>('active');
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const qc = useQueryClient();

  const queryParams = (statusFilter ? { status: statusFilter } : {}) as never;
  const list = useAdminSosControllerList(queryParams);
  const events =
    (list.data?.data as { events?: SosEvent[]; total?: number } | undefined)?.events ?? [];
  const total = (list.data?.data as { total?: number } | undefined)?.total ?? 0;

  const resolveMut = useAdminSosControllerResolve({
    mutation: {
      onSuccess: () => {
        setOpenNoteFor(null);
        setNoteDraft('');
        void qc.invalidateQueries({
          queryKey: getAdminSosControllerListQueryKey(queryParams),
        });
      },
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">SOS triage</h1>
        <p className="text-sm text-muted">
          Resolve once safe out-of-band. {total} {statusFilter || 'all'} events.
        </p>
      </header>

      <div className="flex gap-2 text-xs">
        {(['active', 'resolved', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            className={`rounded-md border px-3 py-1 font-semibold ${
              statusFilter === s
                ? 'border-rose-500 bg-rose-500/10 text-rose-700'
                : 'border-muted/15'
            }`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="rounded-md border border-muted/15 p-3 text-sm text-muted">
          No matching SOS events.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border border-muted/15 bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  🚨 {e.trigger} · user {e.userId.slice(0, 10)}…
                </span>
                <span
                  className={`text-xs uppercase tracking-wide ${
                    e.resolvedAt ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {e.resolvedAt ? 'resolved' : 'active'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Triggered {new Date(e.createdAt).toLocaleString()}
                {e.resolutionNote ? ` · note: ${e.resolutionNote}` : null}
              </p>
              {!e.resolvedAt ? (
                <div className="mt-2">
                  {openNoteFor === e.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteDraft}
                        onChange={(ev) => setNoteDraft(ev.target.value)}
                        placeholder="Resolution note (optional, max 500 chars)"
                        rows={2}
                        maxLength={500}
                        className="w-full rounded border border-muted/15 bg-surface px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={resolveMut.isPending}
                          onClick={() =>
                            resolveMut.mutate({
                              id: e.id,
                              data: noteDraft.trim() ? { note: noteDraft.trim() } : { note: null },
                            })
                          }
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Resolve SOS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenNoteFor(null);
                            setNoteDraft('');
                          }}
                          className="rounded-md border border-muted/15 px-3 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenNoteFor(e.id)}
                      className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
