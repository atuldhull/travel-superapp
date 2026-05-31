/** Vitest specs for AE407 Vault glyph math. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VAULT_LAYOUT,
  formatMinorAmount,
  glyphOpacity,
  glyphSize,
  priceDroppedRecently,
  priceSparkline,
} from '../../src/components/aether/phase2/vault-glyphs';

describe('glyphSize (pure)', () => {
  it('cheapest → minSize, most expensive → maxSize', () => {
    expect(glyphSize(100, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 9);
    expect(glyphSize(500, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxSize, 9);
  });
  it('midpoint → halfway between min + max', () => {
    expect(glyphSize(300, 100, 500)).toBeCloseTo(
      (DEFAULT_VAULT_LAYOUT.minSize + DEFAULT_VAULT_LAYOUT.maxSize) / 2,
      6,
    );
  });
  it('degenerate range → minSize', () => {
    expect(glyphSize(300, 300, 300)).toBe(DEFAULT_VAULT_LAYOUT.minSize);
  });
  it('non-finite amount → minSize', () => {
    expect(glyphSize(Number.NaN, 100, 500)).toBe(DEFAULT_VAULT_LAYOUT.minSize);
    expect(glyphSize(Number.POSITIVE_INFINITY, 100, 500)).toBe(DEFAULT_VAULT_LAYOUT.minSize);
  });
  it('out-of-range amount clamps to [minSize, maxSize]', () => {
    expect(glyphSize(50, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.minSize, 9);
    expect(glyphSize(700, 100, 500)).toBeCloseTo(DEFAULT_VAULT_LAYOUT.maxSize, 9);
  });
});

describe('glyphOpacity (pure)', () => {
  it('cheapest → minOpacity, most expensive → maxOpacity', () => {
    expect(glyphOpacity(100, 100, 500)).toBe(DEFAULT_VAULT_LAYOUT.minOpacity);
    expect(glyphOpacity(500, 100, 500)).toBe(DEFAULT_VAULT_LAYOUT.maxOpacity);
  });
  it('degenerate range → minOpacity', () => {
    expect(glyphOpacity(100, 100, 100)).toBe(DEFAULT_VAULT_LAYOUT.minOpacity);
  });
});

describe('formatMinorAmount (pure)', () => {
  it('formats INR major units with currency style', () => {
    const out = formatMinorAmount(1_800_000, 'INR');
    expect(out).toContain('18,000');
  });
  it('non-finite → "—"', () => {
    expect(formatMinorAmount(Number.NaN, 'INR')).toBe('—');
    expect(formatMinorAmount(Number.POSITIVE_INFINITY, 'USD')).toBe('—');
  });
  it('falls back gracefully on unknown currency', () => {
    // "ZZZ" is not a real ISO code — Intl.NumberFormat usually throws.
    // The helper should still produce a string.
    const out = formatMinorAmount(50000, 'ZZZ');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('priceSparkline (pure)', () => {
  it('empty history → empty points', () => {
    expect(priceSparkline([])).toEqual([]);
  });
  it('single point → centred', () => {
    const out = priceSparkline([100]);
    expect(out.length).toBe(1);
    expect(out[0]?.x).toBe(DEFAULT_VAULT_LAYOUT.sparklineWidth / 2);
  });
  it('two points span the width', () => {
    const out = priceSparkline([100, 200]);
    expect(out[0]?.x).toBe(0);
    expect(out[1]?.x).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineWidth, 6);
  });
  it('higher prices → smaller y (top in SVG)', () => {
    const out = priceSparkline([100, 200]);
    expect(out[0]?.y).toBeCloseTo(DEFAULT_VAULT_LAYOUT.sparklineHeight, 6); // cheap = bottom
    expect(out[1]?.y).toBeCloseTo(0, 6); // expensive = top
  });
  it('flat history → centred y', () => {
    const out = priceSparkline([100, 100, 100]);
    for (const pt of out) {
      expect(pt.y).toBe(DEFAULT_VAULT_LAYOUT.sparklineHeight / 2);
    }
  });
});

describe('priceDroppedRecently (pure)', () => {
  it('true when last < first', () => {
    expect(priceDroppedRecently([100, 95, 90])).toBe(true);
  });
  it('false when prices rose', () => {
    expect(priceDroppedRecently([100, 105, 110])).toBe(false);
  });
  it('false on empty / single-entry history', () => {
    expect(priceDroppedRecently([])).toBe(false);
    expect(priceDroppedRecently([100])).toBe(false);
  });
});
