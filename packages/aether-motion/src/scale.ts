/**
 * @app/aether-motion / scale — spacing, radius, elevation, z-index.
 *
 * 8-point grid base. Spacing names use object metaphors (gutter, margin,
 * margin-large) not numbers (sp-4, sp-8) so renaming the values later
 * doesn't break a thousand call sites.
 */

/** Spacing scale in pixels — 8-point grid + a few half-steps. */
export const space = {
  /** 4px — micro gaps inside compact UI (icon + label). */
  hairline: 4,
  /** 8px — default gap between related items. */
  tight: 8,
  /** 12px — comfortable inline gap. */
  inline: 12,
  /** 16px — section internal padding. */
  comfy: 16,
  /** 24px — between unrelated sections inside a card. */
  loose: 24,
  /** 32px — between cards / surface gutters. */
  gutter: 32,
  /** 48px — margin between major page regions. */
  margin: 48,
  /** 80px — hero region top/bottom breathing room. */
  hero: 80,
  /** 128px — surface top margin on desktop. */
  surface: 128,
} as const;

export type SpaceName = keyof typeof space;

/** Radius scale — Warm Italian leans toward generous rounding for
 *  cards/sheets but keeps buttons modestly rounded. No 100% pill shapes. */
export const radius = {
  /** 0 — used for full-bleed edges. */
  none: 0,
  /** 4px — pill-ish chips, small inputs. */
  sm: 4,
  /** 8px — buttons, inputs, small cards. */
  md: 8,
  /** 14px — cards, panels, modal corners. */
  lg: 14,
  /** 24px — sheets, large surfaces, hero cards. */
  xl: 24,
  /** 9999 — true circles + pills (icons, avatars). */
  pill: 9999,
} as const;

export type RadiusName = keyof typeof radius;

/** Elevation — paired shadow tokens. Aether shadows are warm
 *  (espresso-tinted) and never use pure rgba(0,0,0,*). */
export interface Elevation {
  readonly shadow: string;
  readonly z: number;
}

export const elevation = {
  flat: { shadow: 'none', z: 0 },
  rest: {
    shadow: '0 1px 2px rgba(42, 30, 24, 0.06), 0 0 1px rgba(42, 30, 24, 0.08)',
    z: 1,
  },
  raised: {
    shadow: '0 2px 8px rgba(42, 30, 24, 0.08), 0 1px 2px rgba(42, 30, 24, 0.06)',
    z: 2,
  },
  lifted: {
    shadow: '0 8px 24px rgba(42, 30, 24, 0.12), 0 2px 6px rgba(42, 30, 24, 0.08)',
    z: 4,
  },
  overlay: {
    shadow: '0 24px 64px rgba(42, 30, 24, 0.20), 0 8px 16px rgba(42, 30, 24, 0.10)',
    z: 8,
  },
} as const satisfies Record<string, Elevation>;

export type ElevationName = keyof typeof elevation;

/** Layer z-index scale — keep these names + numbers in app code, never
 *  raw `zIndex: 9999`. */
export const layer = {
  base: 0,
  raised: 10,
  sticky: 100,
  drawer: 500,
  modal: 1000,
  overlay: 2000,
  toast: 5000,
  /** Pulse always-present AI — sits above everything except dev tools. */
  pulse: 9000,
  devtool: 100000,
} as const;

export type LayerName = keyof typeof layer;
