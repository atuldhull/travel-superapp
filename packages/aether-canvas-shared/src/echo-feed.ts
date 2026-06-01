/**
 * AE418 — pure helpers for the Echo social feed (Phase 3, Surface #6).
 *
 * Per docs/aether/02-surfaces.md §6 Echo: "vertical-scroll TikTok-style,
 * but it's not just videos. Each 'echo' is one moment from someone's
 * trip: a photo + 1-sentence diary entry + the place's PlaceOrb."
 * The user swipes up to save the place, right to follow the traveller,
 * long-presses to ask the AI "plan me a trip like this." The page
 * palette continuously re-derives from the current echo's photos.
 *
 * AE418 ships the data model + pure feed-navigation helpers. AE419
 * wires the R3F scene; AE420 wires swipe + palette re-derivation;
 * AE422 wires the procedural audio bed. The eventual integration
 * with `useFeedController*` + `useSocialGraphController*` lands in a
 * b-slice once those SDK hooks expose the social shape Echo needs.
 *
 * Pure — no React, no R3F. Each helper is a pure function paired
 * with a vitest spec.
 */

/** Minimal shape Echo reads. Distinct from the 1.0 `FeedItemDto`
 *  (which is kind/occurredAt/payload) because Echo needs presentation
 *  fields the social-graph back-end will assemble per b-slice. The
 *  field set mirrors the AE418 sample catalogue + the JSDoc on each
 *  field is the contract the future feed adapter must satisfy. */
export interface EchoItem {
  /** Stable id from the feed source. */
  readonly id: string;
  /** Display name of the traveller who posted this echo. */
  readonly traveller: string;
  /** Short slug for the traveller — drives the follow-mutation key. */
  readonly travellerHandle: string;
  /** The place this echo is about. */
  readonly placeName: string;
  /** Curated destination slug (or null if the place isn't on the curated list). */
  readonly destinationSlug: string | null;
  /** Photo URL — the visual focal point. Null while loading. */
  readonly photoUrl: string | null;
  /** Dominant colour of the photo (hex), drives the AE420 palette
   *  re-derivation. Pre-computed server-side; if null we fall back
   *  to the locked Warm Italian baseline. */
  readonly dominantColor: string | null;
  /** One-sentence diary entry. Echo's spec limits this to ~140 chars
   *  so the typeface stays editorial. */
  readonly diary: string;
  /** ISO-8601 timestamp the echo was posted. */
  readonly postedAt: string;
}

/** Direction of a swipe gesture. Used to decide which Echo action
 *  fires on release. */
export type EchoSwipeDirection = 'up' | 'down' | 'left' | 'right' | null;

/** Swipe intent the user is performing. Distinct from direction so
 *  the UI can label the button-row independently of the gesture. */
export type EchoAction = 'save-place' | 'follow-traveller' | 'plan-like-this' | 'next' | 'prev';

/** Minimum pixel delta below which a swipe is ignored as scroll noise. */
export const ECHO_SWIPE_NOISE_PX = 24;

/** Decide the swipe direction from a (dx, dy) tuple. The component
 *  that observes pointer-down + pointer-up subtracts the start
 *  coordinates from the end coordinates and feeds the delta in. */
export function echoSwipeDirectionFromDelta(
  dx: number,
  dy: number,
  noisePx: number = ECHO_SWIPE_NOISE_PX,
): EchoSwipeDirection {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < noisePx && absY < noisePx) return null;
  if (absY >= absX) {
    return dy < 0 ? 'up' : 'down';
  }
  return dx < 0 ? 'left' : 'right';
}

/** Map a swipe direction to an Echo action. Down + left are folded
 *  to next/prev so the feed walks even without intent overlay. */
export function echoActionForSwipe(direction: EchoSwipeDirection): EchoAction | null {
  switch (direction) {
    case 'up':
      return 'save-place';
    case 'right':
      return 'follow-traveller';
    case 'down':
      return 'next';
    case 'left':
      return 'prev';
    case null:
      return null;
  }
}

/** Advance / rewind the active index. Clamps at the ends so the feed
 *  doesn't wrap (Echo's feed is a chronological river, not a loop). */
export function nextEchoIndex(current: number, total: number, action: EchoAction | null): number {
  if (total === 0) return 0;
  if (action === 'next') return Math.min(current + 1, total - 1);
  if (action === 'prev') return Math.max(current - 1, 0);
  return current;
}

/** Saturate a hex colour to a more vivid form for the palette glow.
 *  Used by AE420 — when the dominant-colour blue is too muted we want
 *  the surface to read as deliberate, not washed out. Pure: caller
 *  passes the dominant colour, helper returns the boosted version. */
export function boostHexColor(hex: string | null, factor: number = 1.25): string {
  if (hex === null) return '#C2614A';
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return hex;
  const n = parseInt(m[1] ?? '0', 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const max = Math.max(r, g, b);
  if (max === 0) return hex;
  const scale = Math.min(255 / max, factor);
  const boost = (c: number): number => Math.max(0, Math.min(255, Math.round(c * scale)));
  const hexN = (boost(r) << 16) | (boost(g) << 8) | boost(b);
  return `#${hexN.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Derive a 5-slot Aether palette `[ink, surface, accent, glow, support]`
 *  from a single dominant photo colour. Falls back to the Warm Italian
 *  baseline when the input is null. The shell pipes the resulting tuple
 *  through `<SurfacePaletteVars/>` so CSS-var consumers re-tint live. */
export function echoPaletteFromDominantColor(
  dominantColor: string | null,
): readonly [string, string, string, string, string] {
  // Locked baseline so the page never reads as "off-brand" even if
  // the photo is missing or has no usable dominant colour.
  const baseline = ['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C'] as const;
  if (dominantColor === null) return baseline;
  const m = /^#?([0-9a-f]{6})$/i.exec(dominantColor.trim());
  if (m === null) return baseline;
  // The accent (slot 2) becomes the boosted dominant colour; the glow
  // (slot 3) is a softer tint of the same; ink/surface/support stay
  // warm so the Italian frame is preserved.
  const accent = boostHexColor(dominantColor, 1.2);
  const glow = boostHexColor(dominantColor, 1.45);
  return [baseline[0], baseline[1], accent, glow, baseline[4]] as const;
}

/** Format the published-at timestamp for the small footer tag on each
 *  echo. Reuses the AE253 `formatRelativeAether` semantics inline so
 *  Echo doesn't import the aether-pulse helper graph for one string. */
export function formatEchoPostedAt(postedAt: string | null, now: number = Date.now()): string {
  if (postedAt === null || postedAt === '') return '';
  const t = new Date(postedAt).getTime();
  if (!Number.isFinite(t)) return '';
  const deltaMs = now - t;
  if (deltaMs < 60_000) return 'just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return new Date(postedAt).toLocaleDateString();
}
