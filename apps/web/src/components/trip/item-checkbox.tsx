/**
 * Phase 3 (G1) — "Living Trip" completion checkbox for a single
 * ItineraryItem. Optimistic toggle: flip immediately, fire the
 * apiFetch, revert on error.
 *
 * Honest scope: the SDK isn't regen'd yet (documented orval seam),
 * so the routes hit `apiFetch`-direct rather than a generated hook.
 * The DTO change on the API side (additive `completedAt` field)
 * IS present, but consumers read it via the cast on the parent
 * component since the orval cache is stale.
 */
'use client';

import { useState } from 'react';
import { apiFetch } from '@app/sdk';
import { Check } from 'lucide-react';

interface Props {
  readonly itemId: string;
  readonly initialCompletedAt: string | null;
}

export function ItemCheckbox({ itemId, initialCompletedAt }: Props) {
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [saving, setSaving] = useState(false);

  const checked = completedAt !== null;

  async function toggle() {
    if (saving) return;
    const previous = completedAt;
    // Optimistic flip.
    setCompletedAt(checked ? null : new Date().toISOString());
    setSaving(true);
    try {
      const route = checked
        ? `/api/v1/trips/items/${itemId}/uncomplete`
        : `/api/v1/trips/items/${itemId}/complete`;
      const res = await apiFetch<{
        data: { id: string; completedAt: string | null };
        status: number;
        headers: Headers;
      }>(route, { method: 'POST' });
      if (res.data && (res.data.completedAt === null || typeof res.data.completedAt === 'string')) {
        // Sync to the canonical timestamp from the server.
        setCompletedAt(res.data.completedAt);
      }
    } catch {
      // Honest fallback: revert to the previous state. The user can
      // try again; we don't surface a toast for one row's hiccup.
      setCompletedAt(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={checked}
      aria-label={checked ? 'Mark not done' : 'Mark done'}
      disabled={saving}
      className={
        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition disabled:opacity-50 ' +
        (checked
          ? 'border-gold-600 bg-gold-500/30 text-gold-700 dark:text-gold-200'
          : 'border-muted/40 text-transparent hover:border-gold-600/60 hover:bg-gold-500/10')
      }
    >
      <Check aria-hidden className="h-3 w-3" />
    </button>
  );
}
