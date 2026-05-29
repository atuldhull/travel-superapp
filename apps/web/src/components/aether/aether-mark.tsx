'use client';

/**
 * <AetherMark> — the Aether wordmark glyph.
 *
 * A hand-drawn SVG mark replacing the literal ॐ emoji that DriftNav
 * shipped through AE39. The Devanagari ॐ rendered inconsistently
 * across Windows / macOS / Android (different font fallbacks, the
 * Windows fallback in particular had a flat-bottomed glyph that
 * jarred against the rest of the editorial type). This SVG is the
 * same essential shape — a closed lotus loop above a tail — but
 * proportioned for the terracotta pill cap.
 *
 * Sizes inherit from `font-size` (uses `em` for radii) so it scales
 * with whatever cap surrounds it.
 *
 * Single colour, takes `color` from CSS — the cap inherits its
 * `color` from the parent (DriftNav sets surface.base on the pill).
 */
import type { CSSProperties } from 'react';

export interface AetherMarkProps {
  readonly size?: number;
  readonly title?: string;
  readonly style?: CSSProperties;
  readonly className?: string;
}

export function AetherMark({
  size = 18,
  title = 'Aether',
  style,
  className,
}: AetherMarkProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      style={style}
      className={className}
      // currentColor inheritance is what makes this swappable into
      // the existing terracotta pill (which sets color: surface.base).
      fill="currentColor"
    >
      <title>{title}</title>
      {/* Outer ring — the lotus loop. Two-stop stroke gives the hand-
          drawn weight without dual paths. */}
      <circle
        cx="12"
        cy="11"
        r="6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Inner mark — the dot above (chandrabindu / aether eye). */}
      <circle cx="12" cy="4.5" r="1.2" />
      {/* Tail — a soft serif curl from the bottom of the loop, evoking
          the descending tail of ॐ + the calligraphic flourish on
          Italian magazine wordmarks. Cubic curve falls right, then
          gently lifts back. */}
      <path
        d="M 12 17.4
           C 13.6 18.6, 15.4 19.0, 16.8 18.4
           C 18.0 17.9, 18.4 16.6, 17.4 15.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bindu — a tiny center dot in the loop for emphasis. */}
      <circle cx="12" cy="11" r="1.05" />
    </svg>
  );
}
