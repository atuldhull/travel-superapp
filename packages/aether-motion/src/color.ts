/**
 * @app/aether-motion / color — Warm Italian tactile palette.
 *
 * Locked 2026-05-28 via docs/aether/06-decisions.md (#3 Brand language).
 *
 * Five base colors derive every surface state. Phase 6 will commission
 * a per-destination editorial palette (Tokyo / Berlin / Marrakech) that
 * substitutes the `terracotta` + `ochre` + `olive` triad while keeping
 * `cream` + `espresso` constant — those two are the contrast spine.
 *
 * Why no Tailwind utility classes: app code should never write a hex
 * value. Theme code reads `palette.terracotta.base`; component code
 * reads `theme.color.accent`. The token graph is the brand.
 */

/** A single colour with its OKLCH-derived state ramp.
 *
 *  - `base`     — the canonical value (matches docs/aether/06-decisions.md).
 *  - `soft`     — base lightened toward cream, ~12% L+.
 *  - `deep`     — base darkened toward espresso, ~12% L-.
 *  - `whisper`  — base at ~8% alpha for tonal washes / hover surfaces.
 *  - `glow`     — base at full saturation, slightly cooled chroma, for
 *                 emissive accents (lit edges, focus rings, AI shimmer).
 */
export interface ColorRamp {
  readonly base: string;
  readonly soft: string;
  readonly deep: string;
  readonly whisper: string;
  readonly glow: string;
}

export interface WarmItalianPalette {
  /** Primary accent — sun-warmed clay; the "do this" colour. */
  readonly terracotta: ColorRamp;
  /** Secondary accent — late-afternoon light; the "we found this" colour. */
  readonly ochre: ColorRamp;
  /** Tertiary — cypress / fig leaf; the "active / live" colour. */
  readonly olive: ColorRamp;
  /** Foundation surface — limestone / paper. */
  readonly cream: ColorRamp;
  /** Foundation ink — burnt umber / espresso grounds. */
  readonly espresso: ColorRamp;
}

/** The locked Warm Italian palette. Every value is hand-derived;
 *  no programmatic L*C*h shifts because the eye sees relationships
 *  the math doesn't. */
export const palette: WarmItalianPalette = {
  terracotta: {
    base: '#C2614A',
    soft: '#D88571',
    deep: '#9E4933',
    whisper: 'rgba(194, 97, 74, 0.08)',
    glow: '#E07556',
  },
  ochre: {
    base: '#D9A85C',
    soft: '#E8C088',
    deep: '#B8893F',
    whisper: 'rgba(217, 168, 92, 0.08)',
    glow: '#F2BC6A',
  },
  olive: {
    base: '#6B7A4F',
    soft: '#8B9A6F',
    deep: '#4F5A38',
    whisper: 'rgba(107, 122, 79, 0.08)',
    glow: '#7E9259',
  },
  cream: {
    base: '#F2E8D5',
    soft: '#FAF4E6',
    deep: '#E5D6B8',
    whisper: 'rgba(242, 232, 213, 0.5)',
    glow: '#FFFAEC',
  },
  espresso: {
    base: '#2A1E18',
    soft: '#4A352A',
    deep: '#180F0B',
    whisper: 'rgba(42, 30, 24, 0.08)',
    glow: '#3E2A20',
  },
};

/** Semantic role → palette ramp. App code reads from these, never the
 *  named ramps directly. Roles can be re-skinned per destination in
 *  Phase 6 by remapping this object. */
export interface SemanticColors {
  readonly accent: ColorRamp;
  readonly highlight: ColorRamp;
  readonly live: ColorRamp;
  readonly surface: ColorRamp;
  readonly ink: ColorRamp;
}

export const semantic: SemanticColors = {
  accent: palette.terracotta,
  highlight: palette.ochre,
  live: palette.olive,
  surface: palette.cream,
  ink: palette.espresso,
};

/** Signal colours — used sparingly, never as primary surfaces.
 *  These deliberately don't get a ramp; they're meant to interrupt. */
export const signal = {
  /** Success / confirm / "saved" — bright olive, brighter than the live ramp. */
  success: '#5A8F3A',
  /** Warning / attention — pure ochre, no warmth shift. */
  warning: '#D4A017',
  /** Danger / destructive — un-warmed crimson, snaps the eye. */
  danger: '#B83A2E',
  /** Information / neutral note — deep olive ink. */
  info: '#3D5A4A',
} as const;

/** Token type guard — every `string` token is one of these shapes:
 *    `#RRGGBB` or `rgba(r, g, b, a)`. Used by Storybook + theme tests. */
export const COLOR_TOKEN_PATTERN = /^(#[0-9A-Fa-f]{6}|rgba\([^)]+\))$/;
