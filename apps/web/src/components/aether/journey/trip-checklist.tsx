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

  // AE113 — render the current list as a plain-text bullet block,
  // suitable for pasting into WhatsApp / Notes / iMessage. Done items
  // use ✓ + strikethrough-style prefix; undone items use [ ].
  function asBullets(): string {
    const lines = items.map((it) => (it.done ? `✓ ${it.text}` : `• ${it.text}`));
    return lines.join('\n');
  }
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copyBullets(): Promise<void> {
    const text = asBullets();
    if (text.trim() === '') return;
    try {
      // Clipboard API needs a secure context; fall back to a hidden
      // textarea + document.execCommand for older browsers / file://.
      if (navigator.clipboard !== undefined && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2400);
    }
  }

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
    setItems(starterForSlug(destinationSlug));
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
