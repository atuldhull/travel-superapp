/**
 * v2 trip packing & prep checklist — brings the aether journey
 * checklist capability into the new web, restyled with gold/royal
 * tokens and with no @app/aether-core dependency.
 *
 * Per-trip, persisted to localStorage (`packing:<tripId>:v1`). Seeds a
 * destination-aware starter pack derived from the trip title; users can
 * add / toggle / remove items, copy the list as bullets, and reset.
 * Lives outside the trip data model (device-local) — a backend resource
 * is the natural Phase-1 upgrade.
 */
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, ListChecks, Plus, RotateCcw, X } from 'lucide-react';
import { DESTINATIONS } from '../aether/destinations/data';
import { starterForSlug, type ChecklistItem } from './packing-data';
import { cn } from '../../lib/cn';

function slugFromTitle(title: string): string | undefined {
  const t = title.toLowerCase();
  for (const d of Object.values(DESTINATIONS)) {
    if (t.includes(d.name.toLowerCase())) return d.slug;
  }
  return undefined;
}

function storageKey(tripId: string): string {
  return `packing:${tripId}:v1`;
}

function isItem(v: unknown): v is ChecklistItem {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ChecklistItem).id === 'string' &&
    typeof (v as ChecklistItem).text === 'string' &&
    typeof (v as ChecklistItem).done === 'boolean'
  );
}

function loadStore(tripId: string): ChecklistItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isItem) : null;
  } catch {
    return null;
  }
}

function saveStore(tripId: string, items: readonly ChecklistItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(items));
  } catch {
    // Quota / private mode — silent; the in-memory list still works.
  }
}

function makeId(): string {
  return `c-${Math.random().toString(36).slice(2, 10)}`;
}

export interface TripChecklistProps {
  readonly tripId: string;
  readonly title: string;
}

export function TripChecklist({ tripId, title }: TripChecklistProps): React.ReactElement {
  const slug = useMemo(() => slugFromTitle(title), [title]);
  const [items, setItems] = useState<ChecklistItem[]>(() => starterForSlug(slug));
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hydrate from localStorage on mount (starter shows first paint).
  useEffect(() => {
    const stored = loadStore(tripId);
    if (stored !== null && stored.length > 0) setItems(stored);
    setHydrated(true);
  }, [tripId]);

  // Persist after hydration.
  useEffect(() => {
    if (hydrated) saveStore(tripId, items);
  }, [items, tripId, hydrated]);

  const remaining = useMemo(() => items.filter((it) => !it.done).length, [items]);

  function toggle(id: string): void {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }
  function remove(id: string): void {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }
  function add(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = draft.trim();
    if (text === '') return;
    setItems((prev) => [...prev, { id: makeId(), text, done: false }]);
    setDraft('');
  }
  function resetToStarter(): void {
    setItems(starterForSlug(slug));
  }
  async function copyBullets(): Promise<void> {
    const text = items.map((it) => `${it.done ? '☑' : '☐'} ${it.text}`).join('\n');
    if (text.trim() === '') return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1) sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-600 dark:text-gold-300">
            <ListChecks aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
              Packing &amp; prep
            </h2>
            <p className="text-xs text-muted">
              {remaining === 0 ? 'All packed — you’re ready' : `${remaining} still to sort`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyBullets()}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-gold-600/20 px-3 py-1 text-xs font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {copied ? (
              <Check aria-hidden className="h-3.5 w-3.5 text-gold-600" />
            ) : (
              <Copy aria-hidden className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={resetToStarter}
            className="inline-flex items-center gap-1 rounded-full border border-gold-600/20 px-3 py-1 text-xs font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {items.map((it) => (
          <li
            key={it.id}
            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-gold-500/5"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => toggle(it.id)}
                className="h-4 w-4 shrink-0 accent-gold-600"
              />
              <span
                className={cn(
                  'text-sm transition',
                  it.done ? 'text-muted line-through' : 'text-surface-foreground',
                )}
              >
                {it.text}
              </span>
            </label>
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label={`Remove "${it.text}"`}
              className="shrink-0 rounded-full p-1 text-muted/60 opacity-0 transition hover:bg-danger/10 hover:text-danger focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add one more thing…"
          aria-label="Add a checklist item"
          className="flex-1 rounded-full border border-gold-600/25 bg-surface px-4 py-2 text-sm text-surface-foreground outline-none transition placeholder:text-muted/70 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
        />
        <button
          type="submit"
          disabled={draft.trim() === ''}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 disabled:opacity-50"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Plus aria-hidden className="h-4 w-4" /> Add
        </button>
      </form>

      <p className="mt-3 text-[11px] text-muted/70">
        Saved on this device. A backend-synced list is a future upgrade.
      </p>
    </section>
  );
}
