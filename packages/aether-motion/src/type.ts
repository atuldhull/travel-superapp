/**
 * @app/aether-motion / type — typography tokens.
 *
 * Two-family system locked in 06-decisions.md:
 *   • Display: transitional serif (candidate: GT Sectra, Recoleta). Used
 *     for hero headlines, surface titles, memory-book covers. Never UI.
 *   • UI: tabular sans (candidate: Söhne, Inter Display, Aktiv Grotesk).
 *     Used for everything else — body, labels, buttons, captions.
 *
 * Phase 6 will commission a custom variable display family; until then
 * we reference fallback stacks. Aether component code reads `type.title`
 * not `font-family: "GT Sectra"`.
 *
 * Sizes use a 1.25 modular scale anchored at `body=16px`.
 */

/** Font-family stacks — `display` and `ui` map cleanly to CSS
 *  `font-family` strings. Storybook + theme tests verify the order. */
export const fontFamily = {
  display:
    '"GT Sectra Display", "Recoleta", "Tiempos Headline", "Garamond Premier Pro", Georgia, serif',
  ui: '"Söhne", "Inter Display", "Aktiv Grotesk", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
  /** Mono — for code blocks (Vault receipt details), tabular numerals
   *  when sans can't disambiguate (Atlas coordinates, Pulse timing). */
  mono: '"JetBrains Mono", "Söhne Mono", "Fira Code", ui-monospace, monospace',
} as const;

/** Pixel sizes on the 1.25 modular scale. Use these names — not
 *  the px values — in app code. */
export const fontSize = {
  /** Captions, micro-copy. */
  micro: 11,
  /** Labels, meta. */
  small: 13,
  /** Default body. */
  body: 16,
  /** Lead paragraph, large UI. */
  large: 20,
  /** Subhead. */
  subhead: 25,
  /** Title. */
  title: 31,
  /** Hero — Drift, Atlas surface H1. */
  hero: 49,
  /** Display — used once per surface at most. */
  display: 76,
} as const;

/** Line-heights tuned per scale step — display sizes get tighter,
 *  body gets generous. Numbers are unitless (CSS line-height). */
export const lineHeight = {
  micro: 1.5,
  small: 1.5,
  body: 1.55,
  large: 1.5,
  subhead: 1.35,
  title: 1.25,
  hero: 1.1,
  display: 1.05,
} as const;

/** Letter-spacing in em — display gets negative (optical correction),
 *  micro/small get positive (legibility on small UI). */
export const letterSpacing = {
  micro: 0.02,
  small: 0.01,
  body: 0,
  large: 0,
  subhead: -0.005,
  title: -0.015,
  hero: -0.025,
  display: -0.03,
} as const;

/** Weight tokens — display uses 350 (semi-light) and 600 (semibold);
 *  UI uses 400 / 500 / 600. No 700/black weights anywhere — Warm Italian
 *  is restrained, not shouty. */
export const fontWeight = {
  display: { light: 350, semibold: 600 },
  ui: { regular: 400, medium: 500, semibold: 600 },
} as const;

/** Named text styles — what app code consumes (`textStyle.title`). Each
 *  bundles family + size + line-height + letter-spacing + weight. */
export interface TextStyle {
  readonly family: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly weight: number;
}

const display = (size: keyof typeof fontSize, weight: number): TextStyle => ({
  family: fontFamily.display,
  size: fontSize[size],
  lineHeight: lineHeight[size],
  letterSpacing: letterSpacing[size],
  weight,
});

const ui = (size: keyof typeof fontSize, weight: number): TextStyle => ({
  family: fontFamily.ui,
  size: fontSize[size],
  lineHeight: lineHeight[size],
  letterSpacing: letterSpacing[size],
  weight,
});

export const textStyle = {
  /** Drift / Atlas hero — display serif, light weight. */
  display: display('display', fontWeight.display.light),
  hero: display('hero', fontWeight.display.light),
  title: display('title', fontWeight.display.semibold),
  subhead: ui('subhead', fontWeight.ui.medium),
  large: ui('large', fontWeight.ui.regular),
  body: ui('body', fontWeight.ui.regular),
  bodyMedium: ui('body', fontWeight.ui.medium),
  small: ui('small', fontWeight.ui.regular),
  smallMedium: ui('small', fontWeight.ui.medium),
  micro: ui('micro', fontWeight.ui.medium),
  /** Used for button labels — slightly heavier than body. */
  button: ui('body', fontWeight.ui.semibold),
} as const;

export type TextStyleName = keyof typeof textStyle;
