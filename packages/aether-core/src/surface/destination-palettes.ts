/**
 * Per-destination palettes — curated colour identity per Indian region.
 *
 * AE381 wired per-surface palette derivation; the registry-baked palette
 * gives each Surface a recognisable identity (Drift = sunset, Atlas =
 * deeper earth, Compass = navigation olive). AE384 extends this so the
 * Atlas Surface can re-tint based on the active trip's destination —
 * a Leh trip atlas gets a cool mountain palette; a Goa trip gets sea +
 * warm sand.
 *
 * Pure data + helpers (no React, no Three). The React layer in
 * `palette-hooks.tsx` is extended with `<SurfacePaletteOverride>` so a
 * consumer (Atlas shell) can swap the palette without touching the
 * registered Surface itself.
 *
 * Phase 6 (per 01-architecture.md §Theme) will replace these curated
 * tables with auto-derived k-means on hero photos. The slot names + the
 * `paletteForDestination(slug)` contract stay stable across that change.
 */
import { DEFAULT_SURFACE_PALETTE, type SurfacePalette } from './palette';

/** Cool mountain palette — Leh / Ladakh / Spiti (high-desert blues,
 *  monastery gold, stone). */
const lehPalette: SurfacePalette = ['#0E1A2E', '#E8E2D5', '#7A8FA8', '#C9B870', '#6B7C5A'];

/** Sea + sand — Goa / Andaman / Anjuna. Warm gold over sand cream over
 *  shallow-water teal. */
const goaPalette: SurfacePalette = ['#0F1F2E', '#F6EBD5', '#3F8FA8', '#E8B777', '#5A8579'];

/** Backwater glide — Kerala / Alleppey. Deep palm green + cream + warm
 *  brass + soft accent. */
const keralaPalette: SurfacePalette = ['#0E2418', '#F2E8D5', '#3F8568', '#D6A05F', '#5C7A4A'];

/** Mughal heat — Rajasthan / Jaipur. Deep ochre + cream + pink-sand
 *  accent. */
const jaipurPalette: SurfacePalette = ['#1E0F09', '#F2E0CC', '#A8523C', '#E8B777', '#6E4A3B'];

/** Ghat mysticism — Varanasi. Warm earth + ghat saffron + olive river. */
const varanasiPalette: SurfacePalette = ['#180F0B', '#EDE0CC', '#9A4836', '#D6A05F', '#6E7B5C'];

/** Tea-garden lift — Darjeeling. Deep evergreen + mist cream + warm
 *  tea-leaf gold + sage. */
const darjeelingPalette: SurfacePalette = ['#0E2018', '#E8E2D5', '#5C7A4A', '#D6A05F', '#7A8F6B'];

/** Coffee mist — Coorg. Deep coffee + mist cream + sage glow. */
const coorgPalette: SurfacePalette = ['#1A1408', '#E8E2D5', '#6E7B5C', '#A8B596', '#8B6B3F'];

/** Ruin stillness — Hampi. Sandstone red + cream + boulder olive. */
const hampiPalette: SurfacePalette = ['#1A0F09', '#F2E0CC', '#B0644A', '#C9B870', '#6E7B5C'];

/** The canonical map. Aliases (ladakh → Leh, etc.) live as separate
 *  entries pointing to the same palette object so identity comparisons
 *  succeed in the alias case too. */
export const DESTINATION_PALETTES: Readonly<Record<string, SurfacePalette>> = Object.freeze({
  leh: lehPalette,
  ladakh: lehPalette,
  spiti: lehPalette,
  goa: goaPalette,
  anjuna: goaPalette,
  andaman: goaPalette,
  kerala: keralaPalette,
  alleppey: keralaPalette,
  rajasthan: jaipurPalette,
  jaipur: jaipurPalette,
  varanasi: varanasiPalette,
  darjeeling: darjeelingPalette,
  coorg: coorgPalette,
  hampi: hampiPalette,
});

/** Look up the palette for a destination slug. Case-insensitive. Falls
 *  back to `DEFAULT_SURFACE_PALETTE` when the slug isn't in the catalogue
 *  (or when the input is empty/non-string). */
export function paletteForDestination(slug: string | null | undefined): SurfacePalette {
  if (typeof slug !== 'string' || slug === '') return DEFAULT_SURFACE_PALETTE;
  const key = slug.toLowerCase();
  return DESTINATION_PALETTES[key] ?? DEFAULT_SURFACE_PALETTE;
}

/** True iff this slug has a curated (non-fallback) palette. */
export function hasCuratedPalette(slug: string | null | undefined): boolean {
  if (typeof slug !== 'string' || slug === '') return false;
  return slug.toLowerCase() in DESTINATION_PALETTES;
}

/** All slugs that have curated palettes (stable insertion order). */
export function paletteCuratedSlugs(): ReadonlyArray<string> {
  return Object.keys(DESTINATION_PALETTES);
}

/** Heuristic: pull the most-likely destination slug out of a trip's
 *  title. Matches any curated slug whose lowercase form appears in the
 *  title — first hit wins so "Trip to Leh and Goa" picks 'leh' (the
 *  first match) when iteration order matches insertion. The match is a
 *  word-boundary check so "Goal of the year" doesn't trip 'goa'.
 *
 *  Returns `null` when no curated slug is found. */
export function extractDestinationSlugFromTitle(title: string | null | undefined): string | null {
  if (typeof title !== 'string' || title === '') return null;
  const lower = title.toLowerCase();
  for (const slug of Object.keys(DESTINATION_PALETTES)) {
    const re = new RegExp(`\\b${escapeForRegex(slug)}\\b`, 'i');
    if (re.test(lower)) return slug;
  }
  return null;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
