/**
 * @app/aether-motion — Warm Italian tactile design DNA.
 *
 * Five concerns, one barrel. Subpath imports also work:
 *   import { palette } from '@app/aether-motion/color';
 *   import { book } from '@app/aether-motion/spring';
 *
 * Decisions locked: docs/aether/06-decisions.md (2026-05-28).
 * Phase 0 deliverable: this package + @app/aether-core + @app/aether-canvas
 * + a Drift prototype that proves the tokens render correctly.
 */

export * from './color';
export * from './spring';
export * from './easing';
export * from './type';
export * from './audio';
export * from './scale';

import { semantic, palette } from './color';
import { springs, stagger } from './spring';
import { easings } from './easing';
import { textStyle, fontFamily } from './type';
import { surfaceKeys, envelopes, samples } from './audio';
import { space, radius, elevation, layer } from './scale';

/** The full theme object — one import gets every token.
 *  App code consumes `theme.color.accent.base`, never raw palette
 *  hexes. Per-destination palettes (Phase 6) re-map `theme.color`. */
export const theme = {
  color: semantic,
  palette,
  spring: springs,
  stagger,
  easing: easings,
  text: textStyle,
  font: fontFamily,
  audio: { keys: surfaceKeys, envelopes, samples },
  space,
  radius,
  elevation,
  layer,
} as const;

export type Theme = typeof theme;
