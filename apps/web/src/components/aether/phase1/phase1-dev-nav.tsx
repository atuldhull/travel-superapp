'use client';

/**
 * Phase 1 dev nav — a tiny floating chip strip with `<DissolvingLink>`s
 * between the two top-level Phase 1 routes (Drift + Compass). Atlas
 * requires a real `:id` so it isn't in the chip strip.
 *
 * Production hidden (display: none). Operator sees: a 2-button chip
 * strip at the bottom of the viewport. Clicking either fires the AE382
 * dissolve, waits for the AE375 camera pull-back + AE380 audio fade,
 * then the route changes.
 *
 * The chip strip exists primarily to demonstrate AE383; the eventual
 * production Phase 1 nav (Compass Bird as Atlas's map-pick, the
 * persistent Continuum bar, etc.) lives in later prompts.
 */
import { type CSSProperties } from 'react';
import { DissolvingLink } from './dissolving-link';

const isDev = process.env.NODE_ENV !== 'production';

const containerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  display: isDev ? 'flex' : 'none',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 999,
  background: 'rgba(0, 0, 0, 0.45)',
  zIndex: 10,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.06em',
};

const chipStyle: CSSProperties = {
  color: '#F2E8D5',
  textDecoration: 'none',
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.08)',
  display: 'inline-block',
};

const activeChipStyle: CSSProperties = {
  ...chipStyle,
  background: 'var(--aether-palette-accent, #C2614A)',
  color: '#180F0B',
};

export interface Phase1DevNavProps {
  /** Mark one chip as "active" (the current shell). */
  readonly active?: 'drift' | 'compass';
}

export function Phase1DevNav({ active }: Phase1DevNavProps): React.ReactElement {
  return (
    <div style={containerStyle} aria-hidden>
      <DissolvingLink href="/aether/drift" style={active === 'drift' ? activeChipStyle : chipStyle}>
        Drift
      </DissolvingLink>
      <DissolvingLink
        href="/aether/atlas"
        style={active === 'compass' ? activeChipStyle : chipStyle}
      >
        Compass
      </DissolvingLink>
    </div>
  );
}
