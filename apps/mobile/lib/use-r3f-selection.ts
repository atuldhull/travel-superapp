/**
 * `useR3FSelection<T>` — the shared tap-to-select state for the Aether
 * R3F-native surfaces (Phase 4 AE579, Round BE).
 *
 * Vault (AE545/AE561), Atlas (AE539/AE565), and Lumen (AE549/AE569) all
 * grew the identical "tap a mesh → lift the picked datum into React
 * state → render an RN overlay card → close resumes the idle drift"
 * pattern by hand. This hook is that pattern, once:
 *
 *   - `select(item)` stores the tapped datum (called from the mesh
 *     `onClick` after `e.stopPropagation()`).
 *   - `selected` is the picked datum (or `null` when nothing is open) —
 *     drive the overlay card's mount off it.
 *   - `selectedId` is the picked datum's id (or `null`) — pass it into
 *     the rotating field so it can pause the idle spin + emphasise the
 *     focused mesh while a card is open.
 *   - `close()` clears the selection (the card's Close button) and the
 *     idle drift resumes.
 *
 * The hook is renderer-agnostic on purpose: it holds no `three` or R3F
 * types, just `useState`, so the canvas-shared "framework-free seam"
 * rule still holds and the same hook would serve a Skia surface that
 * wanted lift-to-card behaviour. The caller supplies `getId` so the
 * datum type `T` stays fully generic (orbs, price glyphs, photo planes
 * all carry a string `id` but the hook never assumes the field name).
 */
import { useCallback, useState } from 'react';

export interface R3FSelection<T> {
  /** The currently-selected datum, or `null` when nothing is open. */
  readonly selected: T | null;
  /** The selected datum's id, or `null`. Pass into the rotating field
   *  to pause idle motion + highlight the focused mesh. */
  readonly selectedId: string | null;
  /** Store the tapped datum. Call from the mesh `onClick` handler after
   *  `e.stopPropagation()`. */
  readonly select: (item: T) => void;
  /** Clear the selection (resumes the idle drift). */
  readonly close: () => void;
}

/**
 * Tap-to-select state for an R3F surface.
 *
 * @param getId derives the stable string id of a datum (e.g.
 *   `(orb) => orb.id`). Used to expose `selectedId` for the
 *   pause-idle-rotation + focus-highlight checks.
 */
export function useR3FSelection<T>(getId: (item: T) => string): R3FSelection<T> {
  const [selected, setSelected] = useState<T | null>(null);
  const select = useCallback((item: T) => setSelected(item), []);
  const close = useCallback(() => setSelected(null), []);
  const selectedId = selected === null ? null : getId(selected);
  return { selected, selectedId, select, close };
}
