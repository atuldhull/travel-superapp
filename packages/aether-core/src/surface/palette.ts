/**
 * Surface palette derivation — pure helpers.
 *
 * Every Surface can carry a `palette: readonly string[]` (5 hex colours)
 * that re-tints the scene. AE374 added the slot; AE381 wires it into the
 * scenes. The locked Warm Italian palette (docs/aether/06-decisions.md #3)
 * still anchors the brand — these per-surface palettes are subtle variants
 * within that range so each surface has a recognisable identity without
 * the brand fragmenting.
 *
 * Pure — no React, no Three. The React layer in `palette-hooks.tsx`
 * reads the manager's current surface and looks up the palette here.
 *
 * Phase 6 (per the architecture doc) will replace these curated palettes
 * with per-destination k-means-on-hero-photos derivations. The pure
 * helpers here stay stable; the registry just gets richer data.
 */
import type { Surface } from './types';

/** A surface palette is a 5-colour gradient, stored as hex strings. */
export type SurfacePalette = readonly [string, string, string, string, string];

/** The locked Warm Italian default — every Aether render falls back to
 *  this when no surface-specific palette is registered. Anchored to
 *  `@app/aether-motion`'s theme.palette and theme.color.
 *
 *    [0] dark ink           = #1A0F09
 *    [1] surface cream      = #F2E8D5
 *    [2] terracotta accent  = #C2614A
 *    [3] ochre glow         = #E8B777
 *    [4] olive deep         = #6E7B5C
 */
export const DEFAULT_SURFACE_PALETTE: SurfacePalette = [
  '#1A0F09',
  '#F2E8D5',
  '#C2614A',
  '#E8B777',
  '#6E7B5C',
];

/** True iff this value is a 5-element string array that LOOKS like a
 *  palette (hex shape check is permissive — `rgb()` and `hsl()` strings
 *  also pass so consumers can extend later). */
export function isValidPalette(value: unknown): value is SurfacePalette {
  if (!Array.isArray(value) || value.length !== 5) return false;
  for (const v of value) {
    if (typeof v !== 'string' || v.length === 0) return false;
  }
  return true;
}

/** Derive the palette for a Surface — its own `palette` if set, else the
 *  locked default. Pure; works on `null` (returns default). */
export function paletteForSurface(surface: Surface | null): SurfacePalette {
  if (surface === null) return DEFAULT_SURFACE_PALETTE;
  if (!isValidPalette(surface.palette)) return DEFAULT_SURFACE_PALETTE;
  return surface.palette;
}

/** Slot-name accessors so callers don't have to remember [0]..[4]. */
export interface SurfacePaletteSlots {
  readonly ink: string;
  readonly surface: string;
  readonly accent: string;
  readonly glow: string;
  readonly support: string;
}

/** Ordered slot names — index in this list matches the SurfacePalette
 *  tuple position. Frozen so consumers can't mutate the table. Phase 4
 *  native port needs this to map palette indices to React-Context
 *  property names (no CSS vars on RN). */
export type SurfacePaletteSlotName = keyof SurfacePaletteSlots;

export const PALETTE_SLOT_NAMES: ReadonlyArray<SurfacePaletteSlotName> = Object.freeze([
  'ink',
  'surface',
  'accent',
  'glow',
  'support',
] as const);

/** Convert a palette tuple index (0..4) into its slot name. Returns
 *  `null` for out-of-range / NaN inputs so callers can defensively
 *  guard. Used by `<SurfacePaletteVars/>` when it stamps CSS vars
 *  AND by the native palette context provider. */
export function paletteSlotName(index: number): SurfacePaletteSlotName | null {
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= PALETTE_SLOT_NAMES.length) return null;
  return PALETTE_SLOT_NAMES[index] ?? null;
}

/** Inverse of `paletteSlotName`: look up the tuple index for a slot.
 *  Returns -1 when the name isn't a known slot. */
export function paletteSlotIndex(name: string): number {
  const i = PALETTE_SLOT_NAMES.indexOf(name as SurfacePaletteSlotName);
  return i;
}

/** Project a palette into named slots. Tested without React. */
export function slotsFor(palette: SurfacePalette): SurfacePaletteSlots {
  return {
    ink: palette[0],
    surface: palette[1],
    accent: palette[2],
    glow: palette[3],
    support: palette[4],
  };
}

/** Linear blend between two palettes — used to crossfade between two
 *  Surfaces during a transition. `t = 0` returns `from`, `t = 1` returns
 *  `to`. Hex strings only; rgb()/hsl() inputs degrade to nearest endpoint
 *  (no rgb-string parser inline for now). */
export function blendPalettes(from: SurfacePalette, to: SurfacePalette, t: number): SurfacePalette {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    blendHex(from[0], to[0], clamped),
    blendHex(from[1], to[1], clamped),
    blendHex(from[2], to[2], clamped),
    blendHex(from[3], to[3], clamped),
    blendHex(from[4], to[4], clamped),
  ];
}

/** Blend two hex strings in linear RGB. Inputs must be `#rrggbb`. */
export function blendHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (ca === null || cb === null) return t < 0.5 ? a : b;
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function parseHex(input: string): RGB | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s.length !== 7 || s[0] !== '#') return null;
  const r = Number.parseInt(s.slice(1, 3), 16);
  const g = Number.parseInt(s.slice(3, 5), 16);
  const b = Number.parseInt(s.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return { r, g, b };
}

function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, n));
  return clamped.toString(16).padStart(2, '0');
}

/** Test-only exports for the pure internals. */
export const __testing = { parseHex, toHex };
