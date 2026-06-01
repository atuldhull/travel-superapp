/**
 * AE511 — Behavioural spec for `@app/aether-canvas-shared/src/vault-glyphs.ts`.
 *
 * Pins the pure math for the Vault floating-glyph price model:
 *  - DEFAULT_VAULT_LAYOUT identity + frozen shape
 *  - glyphSize / glyphOpacity linear interpolation, clamping, and degenerate fall-through
 *  - formatMinorAmount Intl currency happy path, em-dash sentinel for non-finite,
 *    and the bare digit-grouping fallback for unknown currency codes
 *  - priceSparkline coordinate generation (empty / singleton / multi / flat) with
 *    inverted SVG-y mapping (top = expensive)
 *  - priceDroppedRecently last-vs-first comparison with the short-history guard
 */
import {
  DEFAULT_VAULT_LAYOUT,
  formatMinorAmount,
  glyphOpacity,
  glyphSize,
  priceDroppedRecently,
  priceSparkline,
  type SparklinePoint,
  type VaultLayoutConfig,
  type VaultPriceLike,
} from '../src';

describe('AE511 - DEFAULT_VAULT_LAYOUT', () => {
  it('exposes the canonical size/opacity/sparkline values', () => {
    expect(DEFAULT_VAULT_LAYOUT.minSize).toBe(0.6);
    expect(DEFAULT_VAULT_LAYOUT.maxSize).toBe(1.8);
    expect(DEFAULT_VAULT_LAYOUT.minOpacity).toBe(0.45);
    expect(DEFAULT_VAULT_LAYOUT.maxOpacity).toBe(0.95);
    expect(DEFAULT_VAULT_LAYOUT.sparklineWidth).toBe(1.6);
    expect(DEFAULT_VAULT_LAYOUT.sparklineHeight).toBe(0.3);
  });

  it('is frozen so callers cannot mutate the shared default', () => {
    expect(Object.isFrozen(DEFAULT_VAULT_LAYOUT)).toBe(true);
  });
});

describe('AE511 - glyphSize linear interpolation', () => {
  it('returns minSize at the floor of the price range', () => {
    expect(glyphSize(100, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 6);
  });

  it('returns maxSize at the ceiling of the price range', () => {
    expect(glyphSize(500, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxSize, 6);
  });

  it('returns the midpoint diameter at the midpoint price', () => {
    const mid = (DEFAULT_VAULT_LAYOUT.minSize + DEFAULT_VAULT_LAYOUT.maxSize) / 2;
    expect(glyphSize(300, 100, 500)).toBeCloseTo(mid, 6);
  });

  it('clamps below the min so a sub-range amount still reads as the floor', () => {
    expect(glyphSize(50, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 6);
  });

  it('clamps above the max so an over-range amount still reads as the ceiling', () => {
    expect(glyphSize(900, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxSize, 6);
  });
});

describe('AE511 - glyphSize degenerate cases', () => {
  it('returns minSize when max equals min (everyone is the same weight)', () => {
    expect(glyphSize(200, 200, 200)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 6);
  });

  it('returns minSize when max is less than min (inverted range)', () => {
    expect(glyphSize(200, 500, 100)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 6);
  });

  it('returns minSize when amountMinor is NaN', () => {
    expect(glyphSize(Number.NaN, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 6);
  });

  it('returns minSize when amountMinor is Infinity', () => {
    expect(glyphSize(Number.POSITIVE_INFINITY, 100, 500)).toBeCloseTo(
      DEFAULT_VAULT_LAYOUT.minSize,
      6,
    );
  });

  it('honours a custom layout config', () => {
    const cfg: VaultLayoutConfig = {
      minSize: 1,
      maxSize: 3,
      minOpacity: 0.1,
      maxOpacity: 0.9,
      sparklineWidth: 2,
      sparklineHeight: 1,
    };
    expect(glyphSize(500, 100, 500, cfg)).toBeCloseTo(3, 6);
    expect(glyphSize(100, 100, 500, cfg)).toBeCloseTo(1, 6);
  });
});

describe('AE511 - glyphOpacity linear interpolation', () => {
  it('returns minOpacity at the floor', () => {
    expect(glyphOpacity(100, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minOpacity, 6);
  });

  it('returns maxOpacity at the ceiling', () => {
    expect(glyphOpacity(500, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxOpacity, 6);
  });

  it('returns the midpoint opacity at the midpoint price', () => {
    const mid = (DEFAULT_VAULT_LAYOUT.minOpacity + DEFAULT_VAULT_LAYOUT.maxOpacity) / 2;
    expect(glyphOpacity(300, 100, 500)).toBeCloseTo(mid, 6);
  });

  it('clamps below the min', () => {
    expect(glyphOpacity(0, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minOpacity, 6);
  });

  it('clamps above the max', () => {
    expect(glyphOpacity(9999, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxOpacity, 6);
  });

  it('returns minOpacity when max equals min', () => {
    expect(glyphOpacity(200, 200, 200)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minOpacity, 6);
  });

  it('returns minOpacity when amountMinor is non-finite', () => {
    expect(glyphOpacity(Number.NaN, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minOpacity, 6);
  });
});

describe('AE511 - formatMinorAmount', () => {
  it('formats a positive INR amount via Intl currency formatting', () => {
    const out = formatMinorAmount(123456, 'INR');
    expect(out).toMatch(/1/);
    expect(out).toMatch(/234/);
  });

  it('converts minor units to major units (divide by 100)', () => {
    const out = formatMinorAmount(50000, 'INR');
    expect(out).toMatch(/500/);
    expect(out).not.toMatch(/50000/);
  });

  it('formats USD amounts using the en-IN locale formatter', () => {
    const out = formatMinorAmount(99900, 'USD');
    expect(out).toMatch(/999/);
  });

  it('returns the em-dash sentinel when amountMinor is NaN', () => {
    expect(formatMinorAmount(Number.NaN, 'INR')).toBe('—');
  });

  it('returns the em-dash sentinel when amountMinor is Infinity', () => {
    expect(formatMinorAmount(Number.POSITIVE_INFINITY, 'USD')).toBe('—');
  });

  it('falls back to bare digit grouping when the currency code is rejected', () => {
    const out = formatMinorAmount(12345, 'NOT_A_REAL_CURRENCY_CODE');
    expect(out).toMatch(/NOT_A_REAL_CURRENCY_CODE/);
    expect(out).toMatch(/123\.45/);
  });

  it('formats zero amounts cleanly', () => {
    const out = formatMinorAmount(0, 'INR');
    expect(out).toMatch(/0/);
  });
});

describe('AE511 - priceSparkline empty + singleton', () => {
  it('returns an empty array for empty history', () => {
    expect(priceSparkline([])).toEqual([]);
  });

  it('centres a singleton history at the midpoint of width and height', () => {
    const pts = priceSparkline([100]);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.x).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineWidth / 2, 6);
    expect(pts[0]?.y).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineHeight / 2, 6);
  });
});

describe('AE511 - priceSparkline multi-point mapping', () => {
  it('spans x evenly across [0, sparklineWidth]', () => {
    const pts = priceSparkline([10, 20, 30, 40]);
    expect(pts).toHaveLength(4);
    expect(pts[0]?.x).toBeCloseTo(0, 6);
    expect(pts[3]?.x).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineWidth, 6);
    const step = DEFAULT_VAULT_LAYOUT.sparklineWidth / 3;
    expect(pts[1]?.x).toBeCloseTo(step, 6);
    expect(pts[2]?.x).toBeCloseTo(step * 2, 6);
  });

  it('maps the max price to y=0 (top, inverted SVG-coords)', () => {
    const pts = priceSparkline([100, 200, 300]);
    expect(pts[2]?.y).toBeCloseTo(0, 6);
  });

  it('maps the min price to y=sparklineHeight (bottom)', () => {
    const pts = priceSparkline([100, 200, 300]);
    expect(pts[0]?.y).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineHeight, 6);
  });

  it('maps an interior price to the proportional inverted height', () => {
    const pts = priceSparkline([100, 200, 300]);
    expect(pts[1]?.y).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineHeight / 2, 6);
  });

  it('produces a downward-trending line for a rising price series (rising = drop-friendly)', () => {
    const pts = priceSparkline([100, 200, 300, 400]);
    expect(pts[0]?.y).toBeGreaterThan(pts[3]?.y ?? 0);
  });
});

describe('AE511 - priceSparkline flat history', () => {
  it('flattens all y values to height/2 when every price is identical', () => {
    const pts = priceSparkline([200, 200, 200, 200]);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      expect(p.y).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineHeight / 2, 6);
    }
  });

  it('honours a custom layout for sparkline dimensions', () => {
    const cfg: VaultLayoutConfig = {
      ...DEFAULT_VAULT_LAYOUT,
      sparklineWidth: 4,
      sparklineHeight: 1,
    };
    const pts = priceSparkline([10, 20], cfg);
    expect(pts[0]?.x).toBeCloseTo(0, 6);
    expect(pts[1]?.x).toBeCloseTo(4, 6);
    expect(pts[1]?.y).toBeCloseTo(0, 6);
    expect(pts[0]?.y).toBeCloseTo(1, 6);
  });
});

describe('AE511 - priceDroppedRecently', () => {
  it('returns false for empty history', () => {
    expect(priceDroppedRecently([])).toBe(false);
  });

  it('returns false for a single-entry history (no comparison possible)', () => {
    expect(priceDroppedRecently([100])).toBe(false);
  });

  it('returns true when the last price is lower than the first', () => {
    expect(priceDroppedRecently([500, 400, 300])).toBe(true);
  });

  it('returns false when the last price equals the first', () => {
    expect(priceDroppedRecently([300, 250, 300])).toBe(false);
  });

  it('returns false when the last price is higher than the first', () => {
    expect(priceDroppedRecently([100, 200, 300])).toBe(false);
  });

  it('only compares first vs last (ignores interior fluctuations)', () => {
    expect(priceDroppedRecently([100, 50, 25, 200])).toBe(false);
    expect(priceDroppedRecently([100, 999, 50])).toBe(true);
  });
});

describe('AE511 - VaultPriceLike + SparklinePoint type ergonomics', () => {
  it('accepts a structural VaultPriceLike without history', () => {
    const p: VaultPriceLike = {
      id: 'stay-1',
      label: 'Hotel A',
      amountMinor: 250000,
      currency: 'INR',
    };
    expect(p.id).toBe('stay-1');
    expect(p.history).toBeUndefined();
  });

  it('accepts a VaultPriceLike with a readonly history array', () => {
    const p: VaultPriceLike = {
      id: 'flight-7',
      label: 'Flight',
      amountMinor: 999900,
      currency: 'USD',
      history: [1000, 950, 900, 920, 880, 870, 860],
    };
    expect(p.history).toHaveLength(7);
    const pts: ReadonlyArray<SparklinePoint> = priceSparkline(p.history ?? []);
    expect(pts).toHaveLength(7);
  });
});
