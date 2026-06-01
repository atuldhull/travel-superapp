/**
 * AE407 — pure helpers for the Vault floating-glyph price model.
 *
 * Per docs/aether/02-surfaces.md §8 Vault: "prices float as weighted
 * glyphs (heavier price = larger, denser glyph; price drops over time
 * = glyphs lighten visibly)". AE407 ships the pure math — glyph size,
 * weight, and 7-day price-history sparkline coordinates. The R3F
 * scene + Stripe Checkout iframe land in later slices.
 *
 * Pure: no React, no DOM, no SDK.
 */

/** Minimal booking-target shape. Reads as the structural subset of
 *  whatever the price comes from (a stay, a transport, a flight). */
export interface VaultPriceLike {
  readonly id: string;
  readonly label: string;
  /** Price in minor units (cents / paise) so we stay integer-safe. */
  readonly amountMinor: number;
  /** ISO currency code — 'INR', 'USD', etc. */
  readonly currency: string;
  /** Optional 7-day price history (newest last). Empty = no sparkline. */
  readonly history?: ReadonlyArray<number>;
}

export interface VaultLayoutConfig {
  /** Min glyph diameter (world units). */
  readonly minSize: number;
  /** Max glyph diameter. */
  readonly maxSize: number;
  /** Min opacity (cheapest items appear lighter). */
  readonly minOpacity: number;
  /** Max opacity (most expensive items appear densest). */
  readonly maxOpacity: number;
  /** Width of the price-history sparkline below each glyph. */
  readonly sparklineWidth: number;
  /** Height of the price-history sparkline. */
  readonly sparklineHeight: number;
}

export const DEFAULT_VAULT_LAYOUT: VaultLayoutConfig = Object.freeze({
  minSize: 0.6,
  maxSize: 1.8,
  minOpacity: 0.45,
  maxOpacity: 0.95,
  sparklineWidth: 1.6,
  sparklineHeight: 0.3,
});

/** Glyph diameter in world units. Heavier price = larger glyph.
 *  Returns minSize when all prices are equal (degenerate range) so the
 *  cloud reads as "all the same weight" rather than blowing up. */
export function glyphSize(
  amountMinor: number,
  minAmount: number,
  maxAmount: number,
  cfg: VaultLayoutConfig = DEFAULT_VAULT_LAYOUT,
): number {
  if (!Number.isFinite(amountMinor)) return cfg.minSize;
  if (maxAmount <= minAmount) return cfg.minSize;
  const norm = Math.max(0, Math.min(1, (amountMinor - minAmount) / (maxAmount - minAmount)));
  return cfg.minSize + (cfg.maxSize - cfg.minSize) * norm;
}

/** Glyph opacity. Heaviest price = densest opacity. */
export function glyphOpacity(
  amountMinor: number,
  minAmount: number,
  maxAmount: number,
  cfg: VaultLayoutConfig = DEFAULT_VAULT_LAYOUT,
): number {
  if (!Number.isFinite(amountMinor)) return cfg.minOpacity;
  if (maxAmount <= minAmount) return cfg.minOpacity;
  const norm = Math.max(0, Math.min(1, (amountMinor - minAmount) / (maxAmount - minAmount)));
  return cfg.minOpacity + (cfg.maxOpacity - cfg.minOpacity) * norm;
}

/** Format a minor-unit amount + currency code into a human-readable
 *  string. Uses `Intl.NumberFormat` with the currency style; falls back
 *  to a plain digit grouping when the runtime doesn't recognise the
 *  currency code (e.g. test-only fake codes). */
export function formatMinorAmount(amountMinor: number, currency: string): string {
  if (!Number.isFinite(amountMinor)) return '—';
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Sparkline coordinate. Y is normalised to [0, sparklineHeight] so the
 *  caller can render it directly with `<line>` / `<path>` SVG. */
export interface SparklinePoint {
  readonly x: number;
  readonly y: number;
}

/** Build sparkline points for a 7-day (or N-day) price history.
 *  - X spans `[0, sparklineWidth]` evenly across the entries
 *  - Y maps min → 0 (top), max → sparklineHeight (bottom), so a rising
 *    line trends downward in SVG-coords (which is the natural read
 *    for "prices going down")
 *  Degenerate range (all-equal prices) flattens to y = height / 2. */
export function priceSparkline(
  history: ReadonlyArray<number>,
  cfg: VaultLayoutConfig = DEFAULT_VAULT_LAYOUT,
): ReadonlyArray<SparklinePoint> {
  if (history.length === 0) return [];
  if (history.length === 1) {
    return [{ x: cfg.sparklineWidth / 2, y: cfg.sparklineHeight / 2 }];
  }
  const min = Math.min(...history);
  const max = Math.max(...history);
  const flat = max <= min;
  const stepX = cfg.sparklineWidth / (history.length - 1);
  return history.map((p, i) => {
    const x = stepX * i;
    if (flat) return { x, y: cfg.sparklineHeight / 2 };
    const norm = (p - min) / (max - min);
    // Invert so higher prices read as a higher y in SVG (top = expensive).
    return { x, y: cfg.sparklineHeight * (1 - norm) };
  });
}

/** Is the most recent price lower than the earliest? Hint for the
 *  scene to render a soft "price dropped" highlight. */
export function priceDroppedRecently(history: ReadonlyArray<number>): boolean {
  if (history.length < 2) return false;
  const first = history[0];
  const last = history[history.length - 1];
  if (first === undefined || last === undefined) return false;
  return last < first;
}
