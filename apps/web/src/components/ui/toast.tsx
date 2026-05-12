/**
 * POST.8 — Hand-rolled toast system. No `sonner` / `react-hot-toast`
 * dep — keeps the bundle tight. ~200 lines: provider + queue +
 * imperative `toast()` API + accessible markup.
 *
 * Usage:
 *   // Mount once (already done in providers.tsx):
 *   <ToastProvider>{children}</ToastProvider>
 *
 *   // Anywhere downstream:
 *   import { toast } from '../components/ui/toast';
 *   toast.success('Trip archived');
 *   toast.error('Could not save');
 *   toast.info('Export started — we\'ll email you when ready');
 *
 * Behaviour:
 *   - Top-right by default; auto-dismiss after 4 seconds.
 *   - Stacks vertically; oldest dismisses first when 5+ are open.
 *   - `aria-live="polite"` + `role="status"` so screen readers
 *     announce without stealing focus.
 *   - Dismiss button (×) on every toast; Escape dismisses the most
 *     recent.
 *   - Theme-aware via Tailwind utilities.
 *   - Pairs with existing `announce()` (lib/announce.ts) — toasts
 *     auto-announce on mount so a single call site covers both
 *     visual + screen-reader feedback.
 */
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { announce } from '../../lib/announce';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastEntry {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly message: string;
}

const MAX_VISIBLE = 5;
const DISMISS_AFTER_MS = 4_000;

/** Module-scoped queue + listeners. Used by the imperative `toast`
 *  API so any caller anywhere in the tree can fire a toast without
 *  threading a context. */
let nextId = 1;
let queue: ToastEntry[] = [];
const listeners = new Set<(items: readonly ToastEntry[]) => void>();

function emit(): void {
  for (const fn of listeners) fn([...queue]);
}

function push(variant: ToastVariant, message: string): void {
  const entry: ToastEntry = { id: nextId++, variant, message };
  queue = [...queue, entry];
  if (queue.length > MAX_VISIBLE) queue = queue.slice(-MAX_VISIBLE);
  emit();
  // Mirror to the ARIA live region so screen-reader users hear it
  // even if the visual toast is dismissed before they look at it.
  announce(message, variant === 'error' ? 'assertive' : 'polite');
  // Auto-dismiss.
  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismiss(entry.id), DISMISS_AFTER_MS);
  }
}

function dismiss(id: number): void {
  queue = queue.filter((t) => t.id !== id);
  emit();
}

function dismissLatest(): void {
  if (queue.length === 0) return;
  const last = queue[queue.length - 1]!;
  dismiss(last.id);
}

/** Imperative API. Call from anywhere — no hooks needed. */
export const toast = {
  success: (message: string): void => push('success', message),
  error: (message: string): void => push('error', message),
  info: (message: string): void => push('info', message),
  /** Test-only — clears the queue. Not used in production code. */
  __reset: (): void => {
    queue = [];
    emit();
  },
};

/** Top-right viewport for rendered toasts. Mounted once by
 *  `ToastProvider`; subscribes to the module queue. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [items, setItems] = useState<readonly ToastEntry[]>([]);

  useEffect(() => {
    const fn = (next: readonly ToastEntry[]) => setItems(next);
    listeners.add(fn);
    fn(queue); // catch up to whatever was pushed before mount
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // Escape dismisses the most recent toast — gives keyboard users a
  // fast path even when the dismiss × isn't focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismissLatest();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-2"
      >
        {items.map((t) => (
          <ToastCard key={t.id} entry={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </>
  );
}

interface CardProps {
  readonly entry: ToastEntry;
  readonly onDismiss: () => void;
}

function ToastCard({ entry, onDismiss }: CardProps) {
  const palette: Record<ToastVariant, string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  };
  const icon: Record<ToastVariant, string> = {
    success: '✓',
    error: '✕',
    info: 'i',
  };
  return (
    <div
      role="status"
      className={
        'pointer-events-auto flex items-start gap-2 rounded-md border bg-surface px-3 py-2 text-sm shadow-(--shadow-depth-2) backdrop-blur-sm ' +
        palette[entry.variant]
      }
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-current font-bold"
      >
        {icon[entry.variant]}
      </span>
      <p className="flex-1 break-words">{entry.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded text-current opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
      >
        ×
      </button>
    </div>
  );
}
