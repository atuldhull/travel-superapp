'use client';

/**
 * `<DriftNowCard>` — the foreground Now Card on the Drift Phase 1
 * surface.
 *
 * Per docs/aether/02-surfaces.md §1 Drift, this card "floats in the
 * foreground" with a time/place/persona-aware prompt. AE385 ships the
 * time-of-day spine: a small eyebrow band (Morning / Afternoon /
 * Evening / Night), a one-line suggestion, and a single-verb CTA.
 *
 * Implementation note: the card is a 2D HTML overlay positioned in
 * front of the `<SurfaceCanvas>` — per 01-architecture.md §Rendering
 * layer ("FlatLayer (CSS3D / Skia for text-rich overlays)"), text-rich
 * surface chrome lives outside the R3F scene. The card reads the AE381
 * CSS vars written by `<SurfacePaletteVars>` so it tints with the
 * active surface palette without needing the SurfaceManager context.
 *
 * The clock is intentionally not refreshed every minute — for Phase 1
 * the content updates only on mount (and on Drift's breath cycle when
 * AE382 re-materialises). The 60-min tick is cheap to add later.
 */
import { useMemo, type CSSProperties } from 'react';
import { useSurfaceLifecycle, type SurfaceLifecyclePhase } from '@app/aether-core';
import { nowCardCssForPhase } from './now-card-lifecycle';
import { nowCardPersonalised } from './upcoming-trip';
import { useUpcomingTrip } from './upcoming-trip-context';

export interface DriftNowCardProps {
  /** Override the time. Tests + Storybook pin this; the live shell omits it. */
  readonly at?: Date | number;
  /** Hide the card (e.g. when the user has dismissed it for this session). */
  readonly hidden?: boolean;
  /** Skip the lifecycle-driven opacity/scale fade — useful for Storybook
   *  fixtures that don't mount the SurfaceManagerProvider. */
  readonly disableLifecycle?: boolean;
}

const baseContainerStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  // transform + opacity + transition are merged in below based on the
  // active lifecycle phase (AE386) so the card breathes with the surface.
  zIndex: 5,
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '14px 22px',
  borderRadius: 16,
  background: 'var(--aether-palette-surface, #F2E8D5)',
  border: '1px solid var(--aether-palette-glow, #E8B777)',
  boxShadow: '0 18px 60px rgba(0, 0, 0, 0.35)',
  color: 'var(--aether-palette-ink, #1A0F09)',
  fontFamily: 'Inter, system-ui, sans-serif',
  // 320px max so the card is readable on mobile too.
  maxWidth: 320,
  textAlign: 'center',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--aether-palette-accent, #C2614A)',
  fontWeight: 600,
};

const suggestionStyle: CSSProperties = {
  fontFamily: 'Playfair Display, Georgia, serif',
  fontStyle: 'italic',
  fontSize: 17,
  lineHeight: 1.35,
  margin: 0,
  color: 'var(--aether-palette-ink, #1A0F09)',
};

const verbStyle: CSSProperties = {
  marginTop: 2,
  padding: '6px 14px',
  borderRadius: 999,
  background: 'var(--aether-palette-accent, #C2614A)',
  color: 'var(--aether-palette-surface, #F2E8D5)',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
};

/** Internal render — receives the resolved phase (or null when the
 *  lifecycle is intentionally disabled). The wrapper above decides
 *  whether to call `useSurfaceLifecycle()` so we don't break the
 *  rules-of-hooks contract. */
function DriftNowCardInner({
  at,
  hidden,
  phase,
}: Omit<DriftNowCardProps, 'disableLifecycle'> & {
  phase: SurfaceLifecyclePhase | null;
}): React.ReactElement | null {
  // AE393 — read the upcoming trip from context (null outside provider).
  // The personalised helper falls back to AE385 time-of-day when no
  // trip qualifies, so the call is safe in every shell.
  const upcomingTrip = useUpcomingTrip();
  const content = useMemo(
    () => nowCardPersonalised(at !== undefined ? at : new Date(), upcomingTrip),
    [at, upcomingTrip],
  );
  if (hidden === true) return null;
  const containerStyle: CSSProperties =
    phase === null
      ? { ...baseContainerStyle, transform: 'translate(-50%, -160%)' }
      : { ...baseContainerStyle, ...nowCardCssForPhase(phase) };
  return (
    <aside style={containerStyle} aria-label={`Now: ${content.headline}`}>
      <span style={eyebrowStyle}>{content.headline}</span>
      <p style={suggestionStyle}>{content.suggestion}</p>
      <button type="button" style={verbStyle} data-aether-now-verb={content.verb}>
        {content.verb}
      </button>
    </aside>
  );
}

/** Wrapper that calls `useSurfaceLifecycle()` — must sit inside a
 *  `<SurfaceManagerProvider>`. */
function DriftNowCardWithLifecycle(
  props: Omit<DriftNowCardProps, 'disableLifecycle'>,
): React.ReactElement | null {
  const phase = useSurfaceLifecycle();
  return <DriftNowCardInner {...props} phase={phase} />;
}

export function DriftNowCard({
  disableLifecycle = false,
  ...rest
}: DriftNowCardProps): React.ReactElement | null {
  if (disableLifecycle) {
    return <DriftNowCardInner {...rest} phase={null} />;
  }
  return <DriftNowCardWithLifecycle {...rest} />;
}
