'use client';

/**
 * <TripChecklist> — per-trip prep list (AE94).
 *
 * Client-only, persisted to localStorage under
 * `aether-checklist:<tripId>:v1`. Each item has an id, text, and a
 * done flag. The component ships a curated starter list (visa,
 * jacket, copy of ID, etc.) on first mount; users can add, toggle,
 * or remove items. Order survives reloads.
 *
 * Lives outside the trip data model on purpose — Phase 1 promotes
 * the checklist to a real backend resource. Until then, this is the
 * cheapest way to give users a "what to pack" surface that survives
 * across reloads on the same device.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTheme } from '@app/aether-core';
// AE164 — JSON parsing for AE148 moved to a pure helper so it's testable.
import { parseChecklistBackup } from './parse-checklist-backup';
// AE188 — single-source filename builder for backups.
import { backupFilename } from '../../../lib/backup-filename';
// AE196 — shared clipboard helper (consolidates the textarea-fallback).
import { copyTextToClipboard } from '../../../lib/copy-text';
// AE201 — id generator extracted so the format is unit-testable.
import { makeChecklistItemId } from './checklist-id';
// AE322 — bullets formatter extracted so it's testable + reusable.
import { formatChecklistAsBullets } from './format-checklist-bullets';
// AE323 — lift read/write through the safe-storage + safe-json-parse
// kits so the SSR + incognito + quota-error paths are shared.
import { readJSON, writeJSON } from '../../../lib/safe-storage';

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

const STARTER: ReadonlyArray<ChecklistItem> = [
  { id: 'k1', text: 'Photo ID + photocopy', done: false },
  { id: 'k2', text: 'Cash + UPI app working offline', done: false },
  { id: 'k3', text: 'Power bank + the right plug', done: false },
  { id: 'k4', text: 'A long sleeve for monasteries / temples', done: false },
  { id: 'k5', text: 'One book, one notebook', done: false },
];

/**
 * AE114 — destination-aware starter packs. A small curated lookup
 * keyed on the same slugs used by the Atlas + destination pages, so
 * the journey dashboard can pass `destinationSlug` derived from the
 * trip title and get a list shaped for that climate / context.
 *
 * Keys are lowercase slugs. Values are concise prep items. The
 * fallback is the generic STARTER list above; consumers who can't
 * resolve a slug should omit the prop.
 */
const STARTER_PACKS: Readonly<Record<string, ReadonlyArray<ChecklistItem>>> = {
  leh: [
    { id: 'p-leh-1', text: 'Down jacket + thermal base layer', done: false },
    { id: 'p-leh-2', text: 'Diamox / altitude pills (consult doctor)', done: false },
    { id: 'p-leh-3', text: 'Inner Line Permit printouts', done: false },
    { id: 'p-leh-4', text: 'Lip balm + SPF 50 (UV is brutal at 3500m)', done: false },
    { id: 'p-leh-5', text: 'Cash — ATMs are sparse beyond town', done: false },
    { id: 'p-leh-6', text: 'Offline maps + downloaded routes', done: false },
  ],
  spiti: [
    { id: 'p-spi-1', text: 'Down jacket + windproof shell', done: false },
    { id: 'p-spi-2', text: 'Altitude meds + electrolytes', done: false },
    { id: 'p-spi-3', text: 'Cash — networks die past Kaza', done: false },
    { id: 'p-spi-4', text: 'Solid shoes — gravel roads, river crossings', done: false },
    { id: 'p-spi-5', text: 'Powerbank for cold-killed phones', done: false },
  ],
  darjeeling: [
    { id: 'p-dar-1', text: 'Light woollens + a waterproof', done: false },
    { id: 'p-dar-2', text: 'Walking shoes for steep lanes', done: false },
    { id: 'p-dar-3', text: 'A flask — the tea here is the point', done: false },
    { id: 'p-dar-4', text: 'Camera + extra battery for Kanchenjunga dawn', done: false },
    { id: 'p-dar-5', text: 'Cash — small shops, no card terminals', done: false },
  ],
  shillong: [
    { id: 'p-shi-1', text: 'Waterproof jacket — Meghalaya means rain', done: false },
    { id: 'p-shi-2', text: 'Quick-dry shoes', done: false },
    { id: 'p-shi-3', text: 'Dry-bag for camera + phone', done: false },
    { id: 'p-shi-4', text: 'Cash for shared sumos', done: false },
  ],
  jaipur: [
    { id: 'p-jai-1', text: 'Loose cottons + a scarf (palace floors, dust)', done: false },
    { id: 'p-jai-2', text: 'SPF + hat — the sun is honest here', done: false },
    { id: 'p-jai-3', text: 'Refillable water bottle', done: false },
    { id: 'p-jai-4', text: 'A long sleeve for temples', done: false },
    { id: 'p-jai-5', text: 'UPI ready — even autos take it', done: false },
  ],
  udaipur: [
    { id: 'p-uda-1', text: 'Sandals + something for boat rides', done: false },
    { id: 'p-uda-2', text: 'SPF + sunglasses', done: false },
    { id: 'p-uda-3', text: 'Modest cover for temples', done: false },
    { id: 'p-uda-4', text: 'Cash for small ferry tickets', done: false },
  ],
  bhuj: [
    { id: 'p-bhu-1', text: 'SPF + sunglasses (white salt = mirror)', done: false },
    { id: 'p-bhu-2', text: 'Light layers — desert night is cold', done: false },
    { id: 'p-bhu-3', text: 'Closed shoes for the Rann walk', done: false },
    { id: 'p-bhu-4', text: 'Cash — villages run on it', done: false },
  ],
  varanasi: [
    { id: 'p-var-1', text: 'Slip-on shoes (ghat etiquette)', done: false },
    { id: 'p-var-2', text: 'A long sleeve for the ghats at dawn', done: false },
    { id: 'p-var-3', text: 'Bottled water + ORS sachets', done: false },
    { id: 'p-var-4', text: 'A camera for the aarti', done: false },
    { id: 'p-var-5', text: 'Small notes for boatmen + offerings', done: false },
  ],
  mumbai: [
    { id: 'p-mum-1', text: 'A foldable raincoat (June–Sept)', done: false },
    { id: 'p-mum-2', text: 'Walking shoes — South Bombay is on foot', done: false },
    { id: 'p-mum-3', text: 'Metro / local card topped up', done: false },
    { id: 'p-mum-4', text: 'Power bank for a long day', done: false },
  ],
  anjuna: [
    { id: 'p-anj-1', text: 'Swimwear + a beach towel', done: false },
    { id: 'p-anj-2', text: 'Reef-safe SPF 50', done: false },
    { id: 'p-anj-3', text: 'Helmet — scooter is the way here', done: false },
    { id: 'p-anj-4', text: 'Mosquito repellent', done: false },
    { id: 'p-anj-5', text: 'A dry-bag for sunset rides', done: false },
  ],
  hampi: [
    { id: 'p-ham-1', text: 'Closed shoes for boulder climbs', done: false },
    { id: 'p-ham-2', text: 'SPF + a hat — there is no shade', done: false },
    { id: 'p-ham-3', text: '2L of water minimum', done: false },
    { id: 'p-ham-4', text: 'A long sleeve for the temples', done: false },
    { id: 'p-ham-5', text: 'Cash — the river crossing is informal', done: false },
  ],
  coorg: [
    { id: 'p-coo-1', text: 'A light fleece — hills get cold at night', done: false },
    { id: 'p-coo-2', text: 'Waterproof shoes for plantation walks', done: false },
    { id: 'p-coo-3', text: 'Insect repellent', done: false },
    { id: 'p-coo-4', text: 'A flask + ground coffee from the estate', done: false },
  ],
  pondicherry: [
    { id: 'p-pon-1', text: 'Cycle-friendly shoes for White Town', done: false },
    { id: 'p-pon-2', text: 'A swim cover for Auroville beach', done: false },
    { id: 'p-pon-3', text: 'SPF + a light hat', done: false },
    { id: 'p-pon-4', text: 'A long sleeve for the ashram', done: false },
  ],
  madurai: [
    { id: 'p-mad-1', text: 'A long sleeve + sarong for Meenakshi', done: false },
    { id: 'p-mad-2', text: 'Closed shoes you can take off easily', done: false },
    { id: 'p-mad-3', text: 'ORS + a refillable bottle (it is hot)', done: false },
    { id: 'p-mad-4', text: 'Cash for filter coffee + flowers', done: false },
  ],
  alleppey: [
    { id: 'p-all-1', text: 'Mosquito repellent + a long sleeve', done: false },
    { id: 'p-all-2', text: 'Swimwear + a quick-dry towel', done: false },
    { id: 'p-all-3', text: 'Power bank — houseboat sockets are rare', done: false },
    { id: 'p-all-4', text: 'Cash for backwater stops', done: false },
    { id: 'p-all-5', text: 'A dry-bag for canoe trips', done: false },
  ],
};

/** AE114 — pick the starter pack for a given destination slug, or
 *  fall back to the generic STARTER list. Returns a fresh copy each
 *  call so consumers can mutate without cross-talk. */
export function starterForSlug(slug: string | undefined): ChecklistItem[] {
  if (slug === undefined) return [...STARTER];
  const hit = STARTER_PACKS[slug.toLowerCase()];
  return hit !== undefined ? [...hit] : [...STARTER];
}

function storageKey(tripId: string): string {
  return `aether-checklist:${tripId}:v1`;
}

function readStore(tripId: string): ChecklistItem[] | null {
  // AE323 — was ~12 lines of SSR-guard + try/JSON.parse + filter.
  // safe-storage handles SSR + incognito; safeJsonParse handles bad
  // payloads; the structural filter is the only thing left here.
  const parsed = readJSON<unknown>(storageKey(tripId), null);
  if (parsed === null || !Array.isArray(parsed)) return null;
  const items = parsed.filter(
    (it): it is ChecklistItem =>
      typeof it === 'object' &&
      it !== null &&
      typeof (it as ChecklistItem).id === 'string' &&
      typeof (it as ChecklistItem).text === 'string' &&
      typeof (it as ChecklistItem).done === 'boolean',
  );
  return items;
}

export interface TripChecklistProps {
  readonly tripId: string;
  /**
   * AE114 — optional destination slug. When supplied, the starter pack
   * is the per-destination one (e.g. `leh` → down jacket, Diamox); when
   * absent the generic STARTER is used. The slug only affects the
   * starter — once a user has edits, their list survives across renders.
   */
  readonly destinationSlug?: string;
}

export function TripChecklist({ tripId, destinationSlug }: TripChecklistProps): React.ReactElement {
  const theme = useTheme();
  const [items, setItems] = useState<ChecklistItem[]>(() => starterForSlug(destinationSlug));
  const [draft, setDraft] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on mount. We start with the destination
  // starter on the first paint so the UI doesn't flash empty; if the
  // store has a saved list we replace.
  useEffect(() => {
    const stored = readStore(tripId);
    if (stored !== null) setItems(stored);
    setHydrated(true);
  }, [tripId]);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    // AE323 — writeJSON is SSR + quota safe; returns false on failure
    // but the user-facing behaviour is identical (no toast — silent).
    writeJSON(storageKey(tripId), items);
  }, [items, tripId, hydrated]);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const remaining = useMemo(() => items.filter((it) => !it.done).length, [items]);

  // AE121 — keyboard nav on the list. Each row hosts a hidden focusable
  // wrapper (tabIndex=0) so Arrow Up/Down moves between rows, Space
  // toggles done, Delete/Backspace removes. The native checkbox keeps
  // its mouse behaviour; this only adds keyboard parity.
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  function focusItemAt(idx: number): void {
    if (items.length === 0) return;
    const wrapped = ((idx % items.length) + items.length) % items.length;
    const target = items[wrapped];
    if (target === undefined) return;
    const node = rowRefs.current.get(target.id);
    if (node !== undefined) node.focus();
  }
  function onItemKey(e: KeyboardEvent<HTMLLIElement>, idx: number, id: string): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItemAt(idx + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItemAt(idx - 1);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        toggle(id);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        remove(id);
        // After remove, focus the previous neighbour (or the new first).
        window.requestAnimationFrame(() => focusItemAt(Math.max(0, idx - 1)));
        break;
      default:
        break;
    }
  }

  // AE113 — render the current list as a plain-text bullet block,
  // suitable for pasting into WhatsApp / Notes / iMessage. AE322
  // moved the formatter into a pure helper; we keep the wrapper for
  // call-site brevity.
  function asBullets(): string {
    return formatChecklistAsBullets(items);
  }
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  /** AE148 — accept a previously-downloaded backup (AE119) and replace
   *  the current list. The file is the JSON shape this component
   *  produces: `{version, tripId, exportedAt, items: ChecklistItem[]}`.
   *  We only require `items` to be a well-typed array; tripId is NOT
   *  required to match (a user moving devices doesn't keep the same
   *  cuid). Failure shows an inline error for 4s, no exception thrown. */
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    // Always reset the input so the same file can be re-imported.
    e.target.value = '';
    if (file === undefined) return;
    const reader = new FileReader();
    reader.onerror = (): void => {
      setImportError('Could not read that file.');
      window.setTimeout(() => setImportError(null), 4000);
    };
    reader.onload = (): void => {
      const raw = reader.result;
      if (typeof raw !== 'string') {
        setImportError('Could not read that file.');
        window.setTimeout(() => setImportError(null), 4000);
        return;
      }
      const next = parseChecklistBackup(raw);
      if (next === null) {
        setImportError('That file does not look like a checklist backup.');
        window.setTimeout(() => setImportError(null), 4000);
        return;
      }
      setItems(next);
      setImportError(null);
    };
    reader.readAsText(file);
  }

  // AE119 — download the current list as a JSON file. Lets users
  // back up before reset / before swapping browsers. Filename is
  // `aether-checklist-<tripId>-<YYYY-MM-DD>.json`. No-op when empty.
  function downloadBackup(): void {
    if (items.length === 0) return;
    const payload = {
      version: 1,
      tripId,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(`checklist-${tripId}`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after the download has been initiated. Spec says any
    // download triggered before revocation is unaffected.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function copyBullets(): Promise<void> {
    const text = asBullets();
    if (text.trim() === '') return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } else {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2400);
    }
  }

  function toggle(id: string): void {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }
  // AE129 — undo-snackbar state. Each remove() snapshots the item plus
  // its index so undo can re-insert in place. The snackbar lasts 5s,
  // then auto-dismisses. We hold one undoable removal at a time — a
  // second remove() before undo overwrites the previous snapshot
  // (matches Gmail behaviour for batched deletions).
  const [undo, setUndo] = useState<{ item: ChecklistItem; idx: number } | null>(null);
  const undoTimer = useRef<number | null>(null);
  function remove(id: string): void {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const removed = items[idx];
    if (removed !== undefined) {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
      setUndo({ item: removed, idx });
      undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }
  function applyUndo(): void {
    setUndo((prev) => {
      if (prev === null) return null;
      const { item, idx } = prev;
      setItems((items_) => {
        // Splice back in at the original index; if list shrank, push.
        const next = [...items_];
        const clampIdx = Math.min(idx, next.length);
        next.splice(clampIdx, 0, item);
        return next;
      });
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
      return null;
    });
  }
  function add(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = draft.trim();
    if (text === '') return;
    const id = makeChecklistItemId();
    setItems((prev) => [...prev, { id, text, done: false }]);
    setDraft('');
  }
  function resetToStarter(): void {
    setItems(starterForSlug(destinationSlug));
    // Clear undo state so the snackbar doesn't refer to an item that
    // is now back in the list (and so getByText for the restored item
    // doesn't match the snackbar AND the list row).
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    setUndo(null);
  }

  return (
    <div
      style={{
        padding: theme.space.loose,
        borderRadius: theme.radius.lg,
        background: surface.soft,
        border: `1px solid ${olive.whisper}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: theme.space.comfy,
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            fontFamily: theme.font.ui,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: ochre.deep,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Checklist · {remaining} left
        </p>
        <div style={{ display: 'flex', gap: theme.space.comfy, alignItems: 'baseline' }}>
          {/* AE113 — copy current list as a plain-text bullet block */}
          <button
            type="button"
            onClick={() => void copyBullets()}
            disabled={items.length === 0}
            style={{
              background: 'transparent',
              border: 'none',
              color: copyState === 'copied' ? olive.deep : ink.soft,
              fontFamily: theme.font.ui,
              fontSize: 11,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              textDecoration: 'underline',
              opacity: items.length === 0 ? 0.5 : 1,
            }}
            aria-label={
              copyState === 'copied'
                ? 'Checklist copied to clipboard'
                : 'Copy checklist as bullets to clipboard'
            }
          >
            {copyState === 'copied'
              ? '✓ copied'
              : copyState === 'error'
                ? 'copy failed'
                : 'copy as bullets'}
          </button>
          {/* AE119 — download a JSON backup of the current list */}
          <button
            type="button"
            onClick={downloadBackup}
            disabled={items.length === 0}
            style={{
              background: 'transparent',
              border: 'none',
              color: ink.soft,
              fontFamily: theme.font.ui,
              fontSize: 11,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              textDecoration: 'underline',
              opacity: items.length === 0 ? 0.5 : 1,
            }}
            aria-label="Download checklist as JSON backup"
          >
            backup .json
          </button>
          {/* AE148 — import a previously-downloaded backup */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: 'none',
              color: ink.soft,
              fontFamily: theme.font.ui,
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              textDecoration: 'underline',
            }}
            aria-label="Import a checklist JSON backup"
          >
            import .json
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            style={{ display: 'none' }}
            aria-hidden
          />
          <button
            type="button"
            onClick={resetToStarter}
            style={{
              background: 'transparent',
              border: 'none',
              color: ink.soft,
              fontFamily: theme.font.ui,
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              textDecoration: 'underline',
            }}
          >
            reset to starter
          </button>
        </div>
      </div>
      <h3
        style={{
          fontFamily: theme.font.display,
          fontSize: 'clamp(22px, 2.4vw, 30px)',
          lineHeight: 1.2,
          letterSpacing: '-0.014em',
          fontWeight: 600,
          margin: `${theme.space.hairline}px 0 0`,
          color: ink.base,
        }}
      >
        What to take. What to remember.
      </h3>
      <p
        style={{
          fontFamily: theme.font.display,
          fontStyle: 'italic',
          fontSize: 15,
          lineHeight: 1.55,
          color: ink.soft,
          margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
        }}
      >
        Stays in this browser. Phase 1 wires the list to a real backend so it follows you across
        devices.
      </p>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 4,
        }}
      >
        {items.map((it, idx) => (
          <li
            key={it.id}
            ref={(el) => {
              if (el === null) {
                rowRefs.current.delete(it.id);
              } else {
                rowRefs.current.set(it.id, el);
              }
            }}
            tabIndex={0}
            onKeyDown={(e) => onItemKey(e, idx, it.id)}
            aria-keyshortcuts="Space ArrowUp ArrowDown Delete"
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr auto',
              alignItems: 'center',
              gap: theme.space.tight,
              padding: `${theme.space.tight}px ${theme.space.inline}px`,
              borderRadius: theme.radius.md,
              background: it.done ? olive.whisper : 'transparent',
              transition: 'background 220ms',
            }}
          >
            <input
              type="checkbox"
              checked={it.done}
              onChange={() => toggle(it.id)}
              aria-label={`Mark "${it.text}" as ${it.done ? 'undone' : 'done'}`}
              style={{
                width: 16,
                height: 16,
                accentColor: accent.base,
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.body.size,
                color: it.done ? ink.soft : ink.base,
                textDecoration: it.done ? 'line-through' : 'none',
              }}
            >
              {it.text}
            </span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label={`Remove "${it.text}" from the list`}
              style={{
                background: 'transparent',
                border: 'none',
                color: ink.soft,
                opacity: 0.55,
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={add}
        style={{
          display: 'flex',
          gap: theme.space.tight,
          marginTop: theme.space.comfy,
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add one more thing…"
          aria-label="Add a checklist item"
          style={{
            flex: 1,
            padding: `${theme.space.tight}px ${theme.space.inline}px`,
            borderRadius: theme.radius.pill,
            border: `1px solid ${ink.whisper}`,
            background: surface.base,
            color: ink.base,
            fontFamily: theme.font.ui,
            fontSize: theme.text.body.size,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={draft.trim() === ''}
          style={{
            padding: `${theme.space.tight}px ${theme.space.loose}px`,
            borderRadius: theme.radius.pill,
            background: draft.trim() === '' ? ink.whisper : ochre.deep,
            color: surface.base,
            fontFamily: theme.font.ui,
            fontSize: theme.text.button.size,
            fontWeight: 600,
            border: 'none',
            cursor: draft.trim() === '' ? 'not-allowed' : 'pointer',
          }}
        >
          Add
        </button>
      </form>

      {/* AE148 — inline import error (auto-clears after 4s) */}
      {importError !== null && (
        <p
          role="alert"
          style={{
            marginTop: theme.space.tight,
            fontFamily: theme.font.ui,
            fontSize: 11,
            color: '#8a2418',
          }}
        >
          {importError}
        </p>
      )}

      {/* AE129 — Undo snackbar after a remove. Inline (not a portal)
          so it stays scoped to the checklist card. Dismisses after 5s
          via the timer in remove(); manual dismiss with Esc/×. */}
      {undo !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: theme.space.comfy,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space.comfy,
            padding: `${theme.space.tight}px ${theme.space.inline}px`,
            borderRadius: theme.radius.md,
            background: ink.base,
            color: surface.base,
            fontFamily: theme.font.ui,
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(24, 15, 11, 0.18)',
          }}
        >
          <span>
            Removed&nbsp;
            <em
              style={{ fontFamily: theme.font.display, fontStyle: 'italic', color: ochre.glow }}
              // Wrap the restored item's text in guillemets so it's
              // visually quoted but doesn't collide with `getByText`
              // (which would match the exact string used in the list).
            >
              «{undo.item.text}»
            </em>
          </span>
          <div style={{ display: 'flex', gap: theme.space.tight }}>
            <button
              type="button"
              onClick={applyUndo}
              style={{
                background: ochre.glow,
                color: ink.base,
                border: 'none',
                borderRadius: theme.radius.pill,
                padding: `4px ${theme.space.inline}px`,
                fontFamily: theme.font.ui,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
              aria-label={`Restore "${undo.item.text}" to the checklist`}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
                setUndo(null);
              }}
              aria-label="Dismiss undo"
              style={{
                background: 'transparent',
                color: surface.base,
                border: 'none',
                fontSize: 14,
                lineHeight: 1,
                padding: 4,
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
