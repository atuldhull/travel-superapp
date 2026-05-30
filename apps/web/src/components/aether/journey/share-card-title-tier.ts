/**
 * AE283 — pure title-shrink tier picker for the AE79 share card.
 *
 * The 1200×630 share card has limited horizontal space; long
 * titles need to shrink so they don't overflow. AE193 locked the
 * 3-tier rule (110 / 88 / 72px); this helper consolidates the
 * boundary math so a future "go to 4 tiers" / "tighten thresholds"
 * change lands here.
 *
 * Rule:
 *   len <= TIGHT_THRESHOLD → SIZE_LARGE
 *   len <= MID_THRESHOLD   → SIZE_MID
 *   else                   → SIZE_SMALL
 */

export const TIGHT_TITLE_THRESHOLD = 20;
export const MID_TITLE_THRESHOLD = 28;
export const SIZE_LARGE = 110;
export const SIZE_MID = 88;
export const SIZE_SMALL = 72;

export function shareCardTitleSize(title: string): number {
  const len = title.trim().length;
  if (len <= TIGHT_TITLE_THRESHOLD) return SIZE_LARGE;
  if (len <= MID_TITLE_THRESHOLD) return SIZE_MID;
  return SIZE_SMALL;
}
