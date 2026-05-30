/**
 * Vitest data-shape gate (AE182) for the Atlas pin catalogue.
 *
 * The PINS list backs the Leaflet markers, the destinations list
 * under the map, the AE71 nearest-pin lookup, the AE126 in-season
 * chip, and the AE137 sr-only announcer. This spec asserts the
 * contract is not silently broken.
 */
import { describe, expect, it } from 'vitest';
import { PINS } from '../../src/components/aether/atlas/pins';
import { ALL_SLUGS } from '../../src/components/aether/destinations/data';

// India bounding box (rough): lat 6 → 38, lng 67 → 98.
const INDIA_LAT_MIN = 6;
const INDIA_LAT_MAX = 38;
const INDIA_LNG_MIN = 67;
const INDIA_LNG_MAX = 98;

describe('Atlas PINS catalogue', () => {
  it('has 15 entries (matches the curated destination set)', () => {
    expect(PINS.length).toBe(15);
  });

  it('has no duplicate slugs', () => {
    const slugs = PINS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug appears in ALL_SLUGS (destinations data is canonical)', () => {
    for (const p of PINS) {
      expect(ALL_SLUGS).toContain(p.slug);
    }
  });

  it('every pin has non-empty name + state + tagline', () => {
    for (const p of PINS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.state.length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeGreaterThan(0);
    }
  });

  it('every lat/lng falls inside the India bounding box', () => {
    for (const p of PINS) {
      expect(p.lat).toBeGreaterThanOrEqual(INDIA_LAT_MIN);
      expect(p.lat).toBeLessThanOrEqual(INDIA_LAT_MAX);
      expect(p.lng).toBeGreaterThanOrEqual(INDIA_LNG_MIN);
      expect(p.lng).toBeLessThanOrEqual(INDIA_LNG_MAX);
    }
  });

  it('first pin (Leh) is the northernmost; last (Alleppey) is the southernmost', () => {
    // Strict monotonicity is too tight (Jaipur > Shillong in lat even
    // though they share roughly the same band). Assert the endpoints
    // instead — that captures the "north → south overall" intent.
    const lats = PINS.map((p) => p.lat);
    const max = Math.max(...lats);
    const min = Math.min(...lats);
    expect(PINS[0]?.lat).toBe(max);
    expect(PINS[PINS.length - 1]?.lat).toBe(min);
  });

  it('all coordinates are real numbers (not NaN, not infinite)', () => {
    for (const p of PINS) {
      expect(Number.isFinite(p.lat)).toBe(true);
      expect(Number.isFinite(p.lng)).toBe(true);
    }
  });
});
