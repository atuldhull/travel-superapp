'use client';

/**
 * AE410 — `<LumenArrangeMenu>` floating strategy picker.
 *
 * Renders a small palette-tinted pill bar in the bottom-left of the
 * Lumen surface. Each button picks one of the five known layout
 * strategies; the mood option carries an "(AI)" suffix until its
 * CLIP backend ships per AE410's stub.
 *
 * Mounted by the Lumen shell so it sits OUTSIDE the R3F canvas (HTML
 * z-stacked over it). No surface-canvas pointer events bleed through:
 * the bar is a small fixed-position div in the bottom-left corner.
 */
import { useCallback, type CSSProperties } from 'react';
import { useSurfacePaletteSlots } from '@app/aether-core';
import {
  LUMEN_LAYOUT_STRATEGIES,
  isStrategyImplemented,
  layoutStrategyDescription,
  layoutStrategyLabel,
  type LumenLayoutStrategy,
} from './lumen-strategies';
import { useLumenStrategy } from './lumen-strategy-context';

export function LumenArrangeMenu(): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const { strategy, setStrategy } = useLumenStrategy();

  const onPick = useCallback(
    (s: LumenLayoutStrategy) => {
      setStrategy(s);
    },
    [setStrategy],
  );

  const wrap: CSSProperties = {
    position: 'fixed',
    bottom: 20,
    left: 20,
    display: 'flex',
    gap: 6,
    padding: '6px 8px',
    borderRadius: 999,
    background: 'rgba(26, 15, 9, 0.65)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${palette.glow}`,
    zIndex: 8,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    color: palette.surface,
  };

  return (
    <nav style={wrap} aria-label="Lumen layout strategies">
      {LUMEN_LAYOUT_STRATEGIES.map((s) => {
        const active = s === strategy;
        const stub = !isStrategyImplemented(s);
        const btn: CSSProperties = {
          padding: '5px 11px',
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          background: active ? palette.accent : 'transparent',
          color: active ? palette.ink : palette.surface,
          fontSize: 11,
          fontFamily: 'inherit',
          letterSpacing: 'inherit',
        };
        return (
          <button
            key={s}
            type="button"
            style={btn}
            title={layoutStrategyDescription(s)}
            aria-pressed={active}
            aria-label={layoutStrategyDescription(s)}
            onClick={() => onPick(s)}
          >
            {layoutStrategyLabel(s)}
            {stub ? ' (AI)' : ''}
          </button>
        );
      })}
    </nav>
  );
}
