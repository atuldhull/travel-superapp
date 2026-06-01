/**
 * AE419 — pure helpers for the Echo vertical-scroll feed layout.
 *
 * Per 02-surfaces.md §6 each echo is a textured photo plane stacked
 * vertically; the active echo sits at y ≈ 0 (camera center), the
 * next echo waits below at y < 0, and the previous echo trails above
 * at y > 0. As the active index advances we lerp the whole stack up
 * by the inter-card spacing, giving a TikTok-style scroll feel.
 *
 * Pure — no React, no R3F. Mirrors the AE409 museum-arc shape so the
 * scene calls these once per (index, items.length) change via useMemo.
 */
import type { EchoItem } from './echo-feed';

/** Per-card vertical spacing in world units. The active card spans
 *  ~3.5 world units tall, so 4 keeps a small gutter visible above
 *  and below at the scroll boundaries. */
export const ECHO_CARD_SPACING_Y = 4;

/** Default plane size (world units) used by the R3F scene. */
export const ECHO_CARD_WIDTH = 5;
export const ECHO_CARD_HEIGHT = 3.2;

/** Y coordinate for echo `i` given the active index. Active card
 *  sits at y=0; subsequent cards trail downward (negative Y); prior
 *  cards float upward (positive Y). */
export function echoCardY(
  index: number,
  activeIndex: number,
  spacing: number = ECHO_CARD_SPACING_Y,
): number {
  return (activeIndex - index) * spacing;
}

/** Per-card scale at a given offset from the active card. The active
 *  card is full-size; the immediate neighbours are 0.86; cards 2+
 *  away are 0.7 (they're peripheral). */
export function echoCardScale(index: number, activeIndex: number): number {
  const offset = Math.abs(index - activeIndex);
  if (offset === 0) return 1;
  if (offset === 1) return 0.86;
  return 0.7;
}

/** Per-card opacity at a given offset. Active card is 1.0; immediate
 *  neighbours dim to 0.42; cards further out are 0.18 so they barely
 *  read (but still hint the scroll has depth). */
export function echoCardOpacity(index: number, activeIndex: number): number {
  const offset = Math.abs(index - activeIndex);
  if (offset === 0) return 1;
  if (offset === 1) return 0.42;
  if (offset === 2) return 0.18;
  return 0;
}

/** True when the card at `index` should be rendered at all. A
 *  6-item feed renders the active + 2 above + 2 below; cards past
 *  that are skipped so we don't pay for off-screen textures. */
export function echoCardVisible(index: number, activeIndex: number): boolean {
  return Math.abs(index - activeIndex) <= 2;
}

/** Filter the items array to just those the scene should mount.
 *  Returns the original index alongside so each entry knows where it
 *  sits in the global feed for `echoCardY` etc. */
export function visibleEchoSlots<T extends { readonly id: EchoItem['id'] }>(
  items: ReadonlyArray<T>,
  activeIndex: number,
): ReadonlyArray<{ readonly item: T; readonly index: number }> {
  return items
    .map((item, index) => ({ item, index }))
    .filter((entry) => echoCardVisible(entry.index, activeIndex));
}
