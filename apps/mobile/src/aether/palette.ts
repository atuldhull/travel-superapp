/**
 * Aether mobile palette — the locked Warm Italian slots (Phase 4 AE567,
 * hardened into a typed seam at AE580 / Round BE).
 *
 * Single source of truth for the surface colours every Aether mobile
 * scene paints with. The five brand slots live in one
 * `AETHER_PALETTE_SLOTS` object (shape-compatible with the web
 * `SurfacePaletteSlots` from `@app/aether-core`); the individual
 * `AETHER_*` consts every scene already imports are derived from it, so
 * there is exactly one place a hex is written.
 *
 * ── The palette-context seam (decision #3, deferred) ──────────────────
 * The web surfaces read live, per-surface palette overrides from
 * `useSurfacePalette()` / `<SurfacePaletteOverride>`; `@app/aether-core-
 * native` ports that to a React Context (`SurfacePaletteSlotsContext` +
 * `<SurfacePaletteSlotsProvider>`). Mobile does NOT consume it yet, on
 * purpose — three things make the live swap a later slice, not this one:
 *   1. `@app/aether-core-native` re-exports the web `@app/aether-core`
 *      barrel verbatim; pulling it into apps/mobile drags the React-19
 *      `@types/react` of the monorepo into the React-18 mobile tree and
 *      trips the "Type 'ReactNode' … bigint" clash (see the autopilot
 *      notes). It is also not currently an apps/mobile dependency.
 *   2. `<SurfacePaletteSlotsProvider>` calls `useSurfacePaletteSlots()`,
 *      which requires a `<SurfaceManagerProvider>` ancestor — mobile
 *      mounts none yet.
 *   3. Scenes read these slots as module-level `const`s; a runtime
 *      context can only be read via a hook inside a component body.
 *
 * When that slice lands, the swap is confined to THIS file:
 *   a. add `@app/aether-core-native` to apps/mobile deps + install;
 *   b. mount `<SurfaceManagerProvider>` + `<SurfacePaletteSlotsProvider>`
 *      in app/_layout.tsx;
 *   c. change `resolveAetherPaletteSlots()` to coalesce
 *      `useSurfacePaletteSlotsFromContext() ?? AETHER_PALETTE_SLOTS`
 *      (becoming a hook), and migrate the scenes' module-level colour
 *      `const`s into component-body `usePaletteSlots()` reads.
 * Until then `resolveAetherPaletteSlots()` returns the static lock, so
 * the seam is exercised + typed without the risky dependency.
 *
 * Hexes are the Warm Italian lock from docs/aether/06-decisions.md #3.
 */

/** The five brand palette slots — structurally identical to the web
 *  `SurfacePaletteSlots` (ink / surface / accent / glow / support).
 *  Declared locally (not imported from `@app/aether-core`) so this
 *  module stays framework-free + free of the React-18/19 `@types`
 *  clash. The field names match the web contract so the future
 *  context swap is a drop-in. */
export interface AetherPaletteSlots {
  readonly ink: string;
  readonly surface: string;
  readonly accent: string;
  readonly glow: string;
  readonly support: string;
}

/** The locked Warm Italian slots — the single source of truth for every
 *  brand colour on mobile. */
export const AETHER_PALETTE_SLOTS: AetherPaletteSlots = {
  /** Deep ink — the surface background on every scene. */
  ink: '#1A1714',
  /** Raised surface — cards, sheets, rows sitting above the ink. */
  surface: '#24201C',
  /** Terracotta accent — the primary action / focus colour. */
  accent: '#C2614A',
  /** Ochre glow — highlights, active states, the warm end of gradients. */
  glow: '#E8B777',
  /** Olive support — secondary structure (rings, markers, the cool end). */
  support: '#6E7B5C',
};

/**
 * Resolve the active palette slots. The single seam the future
 * palette-context slice swaps (see the file header): today it returns
 * the static lock, optionally shallow-merged with an override; later it
 * coalesces a `SurfacePaletteSlotsContext` read. Returning the same
 * shape both ways means no downstream consumer changes.
 */
export function resolveAetherPaletteSlots(
  override?: Partial<AetherPaletteSlots> | null,
): AetherPaletteSlots {
  if (!override) return AETHER_PALETTE_SLOTS;
  return { ...AETHER_PALETTE_SLOTS, ...override };
}

/** Deep ink — the surface background on every scene. */
export const AETHER_INK = AETHER_PALETTE_SLOTS.ink;

/** Raised surface — cards, sheets, rows sitting above the ink. */
export const AETHER_SURFACE = AETHER_PALETTE_SLOTS.surface;

/** Terracotta accent — the primary action / focus colour. */
export const AETHER_ACCENT = AETHER_PALETTE_SLOTS.accent;

/** Ochre glow — highlights, active states, the warm end of gradients. */
export const AETHER_GLOW = AETHER_PALETTE_SLOTS.glow;

/** Olive support — secondary structure (rings, markers, the cool end). */
export const AETHER_SUPPORT = AETHER_PALETTE_SLOTS.support;

/** Cream — primary text on the ink / surface. A chrome neutral, not one
 *  of the five brand slots (web carries these on the theme, not the
 *  palette), so it lives outside `AETHER_PALETTE_SLOTS`. */
export const AETHER_CREAM = '#F2E8D5';

/** Muted brown — secondary / hint text. Chrome neutral (see cream). */
export const AETHER_MUTED = '#9B8E7E';
