/**
 * V.UX.36 — admin SOS triage queue. Lists active SOS events +
 * inline "Resolve" with optional note. Each resolve emits an
 * audit row server-side (V.UX.36 retrofit on `AdminResolveSosUseCase`).
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band). Semantic traffic-light safety
 * colours are preserved — active emergencies read danger/rose, resolved
 * events read emerald — because the colour *is* the signal on a safety
 * surface.
 */
'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldAlert, Siren } from 'lucide-react';
import {
  getAdminSosControllerListQueryKey,
  useAdminSosControllerList,
  useAdminSosControllerResolve,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';

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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Safety operations
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SOS triage
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Resolve once safe out-of-band. {total} {statusFilter || 'all'} events.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['active', 'resolved', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              statusFilter === s
                ? 'border-danger/50 bg-danger/10 text-danger'
                : 'border-gold-600/25 text-muted hover:border-gold-600/40 hover:text-surface-foreground'
            }`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <Card depth="raised">
          <p className="text-sm text-muted">No matching SOS events.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight text-surface-foreground">
                  <Siren aria-hidden className="h-4 w-4 text-danger" /> {e.trigger} · user{' '}
                  {e.userId.slice(0, 10)}…
                </span>
                {e.resolvedAt ? (
                  <Badge variant="success">resolved</Badge>
                ) : (
                  <Badge variant="danger">active</Badge>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Triggered {new Date(e.createdAt).toLocaleString()}
                {e.resolutionNote ? ` · note: ${e.resolutionNote}` : null}
              </p>
              {!e.resolvedAt ? (
                <div className="mt-3">
                  {openNoteFor === e.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteDraft}
                        onChange={(ev) => setNoteDraft(ev.target.value)}
                        placeholder="Resolution note (optional, max 500 chars)"
                        rows={2}
                        maxLength={500}
                        className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                        >
                          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Resolve SOS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenNoteFor(null);
                            setNoteDraft('');
                          }}
                          className="rounded-full border border-gold-600/25 px-4 py-1.5 text-xs font-semibold text-muted transition hover:border-gold-600/40 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenNoteFor(e.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Resolve
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
