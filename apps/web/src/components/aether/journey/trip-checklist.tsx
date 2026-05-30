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
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTheme } from '@app/aether-core';

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

function storageKey(tripId: string): string {
  return `aether-checklist:${tripId}:v1`;
}

function readStore(tripId: string): ChecklistItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.filter(
      (it): it is ChecklistItem =>
        typeof it === 'object' &&
        it !== null &&
        typeof (it as ChecklistItem).id === 'string' &&
        typeof (it as ChecklistItem).text === 'string' &&
        typeof (it as ChecklistItem).done === 'boolean',
    );
    return items;
  } catch {
    return null;
  }
}

export interface TripChecklistProps {
  readonly tripId: string;
}

export function TripChecklist({ tripId }: TripChecklistProps): React.ReactElement {
  const theme = useTheme();
  const [items, setItems] = useState<ChecklistItem[]>(() => [...STARTER]);
  const [draft, setDraft] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on mount. We start with STARTER on the
  // first paint so the UI doesn't flash empty; if the store has a
  // saved list we replace.
  useEffect(() => {
    const stored = readStore(tripId);
    if (stored !== null) setItems(stored);
    setHydrated(true);
  }, [tripId]);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(tripId), JSON.stringify(items));
    } catch {
      /* quota / private mode */
    }
  }, [items, tripId, hydrated]);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

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
    const id = `u-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
    setItems((prev) => [...prev, { id, text, done: false }]);
    setDraft('');
  }
  function resetToStarter(): void {
    setItems([...STARTER]);
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
        {items.map((it) => (
          <li
            key={it.id}
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
    </div>
  );
}
