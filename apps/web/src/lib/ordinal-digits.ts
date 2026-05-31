/**
 * AE361 — pure 2-digit zero-padded ordinal formatter.
 *
 * Used as the row-prefix label across editorial surfaces — destination
 * moments, about-page principles, journey rows, dispatch rows, Atlas
 * pin list, trip-pdf-doc day caps. 6 sites all call
 * `String(idx + 1).padStart(2, '0')` inline.
 *
 * Centralising the format means a future "3-digit / Roman / hex"
 * change touches one file. Default width is 2 (covers 01..99); pass
 * `width` for surfaces that genuinely need wider (e.g. itinerary day
 * 100+ in a long trip).
 *
 * Negative / NaN / non-finite → '00' (defensive).
 */

export const DEFAULT_ORDINAL_WIDTH = 2;

export function ordinalDigits(n: number, width: number = DEFAULT_ORDINAL_WIDTH): string {
  if (!Number.isFinite(n) || n < 0) {
    return '0'.repeat(width);
  }
  return String(Math.floor(n)).padStart(width, '0');
}

/** Convenience for the most common case: turn a 0-indexed array idx
 *  into a 1-based "01"-style label. */
export function ordinalLabel(idx: number, width: number = DEFAULT_ORDINAL_WIDTH): string {
  return ordinalDigits(idx + 1, width);
}
