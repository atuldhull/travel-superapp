/**
 * AE293 — pure label routing for the AE83 in-season chip on
 * destination cards.
 *
 * Today the chip says "◐ In season now" when inSeason=true.
 * Richer variants:
 *   - in season + best month?     → 'In season · best <Mon>'
 *   - shoulder month (within 1)?  → 'Edge of season'
 *   - off                          → ''  (caller hides)
 *
 * Pure routing; the season-detection logic stays in seasons.ts.
 */

export interface SeasonChipInputs {
  readonly inSeason: boolean;
  readonly shoulder?: boolean;
  readonly bestMonth?: string | null;
}

export function seasonChipLabel(inputs: SeasonChipInputs): string {
  if (inputs.inSeason === true) {
    const best = inputs.bestMonth?.trim();
    if (best !== undefined && best !== '') return `◐ In season · best ${best}`;
    return '◐ In season now';
  }
  if (inputs.shoulder === true) return '◐ Edge of season';
  return '';
}
