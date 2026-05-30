/**
 * AE206 — colour-routing helper for the activity timeline dots.
 *
 * Extracted from journey-dashboard's nested ternary so the kind→colour
 * mapping can be unit-tested without rendering React. The helper takes
 * an abstract palette shape (a structural subset of @app/aether-core's
 * theme.palette) so tests pass fixed hexes and assert routing.
 *
 * Routing (must match the journey-dashboard render):
 *   - 'archive' → palette.ochre.deep
 *   - 'edit'    → palette.olive.deep
 *   - 'share'   → palette.ochre.glow
 *   - 'create'  → palette.accent.deep  (the fallback)
 */

import type { TimelineEvent } from './timeline-grouping';

export interface TimelineDotPalette {
  readonly ochre: { readonly deep: string; readonly glow: string };
  readonly olive: { readonly deep: string };
  readonly accent: { readonly deep: string };
}

export function timelineDotColor(kind: TimelineEvent['kind'], palette: TimelineDotPalette): string {
  if (kind === 'archive') return palette.ochre.deep;
  if (kind === 'edit') return palette.olive.deep;
  if (kind === 'share') return palette.ochre.glow;
  return palette.accent.deep;
}
