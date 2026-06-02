/**
 * Aether mobile palette — the locked Warm Italian slots (Phase 4 AE567).
 *
 * Single source of truth for the surface colours every Aether mobile
 * scene paints with. Previously each scene redefined the same five
 * hexes; they live here now so the brand stays consistent + a future
 * slice can swap the module internals for a palette-context read (from
 * `@app/aether-core-native`'s `SurfacePaletteSlotsContext`) without
 * touching a single scene.
 *
 * The five slots mirror the web `SurfacePaletteSlots` (ink / surface /
 * accent / glow / support) + two chrome neutrals the native UI needs
 * (cream text, muted secondary text). Hexes are the Warm Italian lock
 * from docs/aether/06-decisions.md #3.
 */

/** Deep ink — the surface background on every scene. */
export const AETHER_INK = '#1A1714';

/** Raised surface — cards, sheets, rows sitting above the ink. */
export const AETHER_SURFACE = '#24201C';

/** Terracotta accent — the primary action / focus colour. */
export const AETHER_ACCENT = '#C2614A';

/** Ochre glow — highlights, active states, the warm end of gradients. */
export const AETHER_GLOW = '#E8B777';

/** Olive support — secondary structure (rings, markers, the cool end). */
export const AETHER_SUPPORT = '#6E7B5C';

/** Cream — primary text on the ink / surface. */
export const AETHER_CREAM = '#F2E8D5';

/** Muted brown — secondary / hint text. */
export const AETHER_MUTED = '#9B8E7E';
