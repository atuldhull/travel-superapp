/**
 * V.UX.29 — `?` opens a cheat-sheet overlay listing every global
 * keyboard shortcut. Uses a native `<dialog>` so focus trap +
 * `Esc` to close come for free without dragging in Radix Dialog.
 *
 * Per-page bindings (e.g. `j`/`k` on /trips, `n` to create) are
 * listed here as documentation; the actual handlers live in the
 * page components that own them.
 *
 * Installed by prompt [V.UX.29].
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useShortcut } from '../../lib/use-shortcuts';

interface Row {
  readonly keys: readonly string[];
  readonly label: string;
}

const SHORTCUTS: readonly { readonly section: string; readonly rows: readonly Row[] }[] = [
  {
    section: 'Global',
    rows: [
      { keys: ['Cmd/Ctrl', 'K'], label: 'Open command palette' },
      { keys: ['?'], label: 'Open this cheat sheet' },
      { keys: ['Esc'], label: 'Close palette / sheet / dialog' },
    ],
  },
  {
    section: 'Trip list (/trips)',
    rows: [
      { keys: ['j'], label: 'Focus next trip' },
      { keys: ['k'], label: 'Focus previous trip' },
      { keys: ['Enter'], label: 'Open the focused trip' },
      { keys: ['n'], label: 'New trip' },
    ],
  },
  {
    section: 'Drag list (trip detail)',
    rows: [
      { keys: ['Tab'], label: 'Move to drag handle' },
      { keys: ['↑', '↓'], label: 'Reorder one slot' },
      { keys: ['Home', 'End'], label: 'Jump to start / end' },
    ],
  },
];

export function ShortcutSheet() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement | null>(null);

  useShortcut('shift+/', (e) => {
    e.preventDefault();
    setOpen((v) => !v);
  });
  useShortcut(
    'escape',
    () => {
      if (open) setOpen(false);
    },
    { allowInInput: true, enabled: open },
  );

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      try {
        dlg.showModal();
      } catch {
        dlg.setAttribute('open', '');
      }
    }
    if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        // Click on backdrop closes (target === dialog when click is on backdrop).
        if (e.target === ref.current) setOpen(false);
      }}
      aria-labelledby="shortcut-sheet-title"
      className="w-[min(92vw,520px)] rounded-lg border border-muted/30 bg-surface p-0 text-surface-foreground shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-muted/20 px-4 py-3">
        <h2 id="shortcut-sheet-title" className="text-sm font-semibold">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          aria-label="Close shortcut sheet"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-xs text-muted hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Esc
        </button>
      </div>
      <div className="space-y-4 px-4 py-3 text-sm">
        {SHORTCUTS.map((g) => (
          <section key={g.section}>
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{g.section}</h3>
            <ul className="space-y-1">
              {g.rows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3">
                  <span>{r.label}</span>
                  <span className="flex items-center gap-1">
                    {r.keys.map((k, i) => (
                      <kbd
                        key={`${r.label}-${k}-${i}`}
                        className="rounded border border-muted/30 bg-muted/10 px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
