'use client';

/**
 * `<Phase1ContinuumBar>` — AE390 cross-device handoff edge-line.
 *
 * Per docs/aether/02-surfaces.md §10 the Continuum bar is "always visible
 * on the edge of the screen as a single subtle line" and tapping it
 * "shows your current surface state encoded as a QR" so another device
 * can resume. Phase 4 plans WebTransport state-sync; the architecture
 * doc says Phase 1 ships the deep-link fallback — that's what AE390
 * delivers.
 *
 * Layout:
 *   • a 4px fixed-bottom line spanning the full viewport (subtle,
 *     palette.accent-tinted; honours the registered overlay surface
 *     gate via `manager.overlays`)
 *   • clicking / pressing Enter opens a small popover-positioned
 *     above the bar showing:
 *       - the deterministic 21×21 handoff sigil (AE390 continuum-sigil)
 *       - the deep-link URL (full origin + path + extras + marker)
 *       - [Copy link] + [Share…] (Web Share API when available)
 *       - [Close]
 *
 * Honest disclosure: the sigil is NOT a scannable QR; the real handoff
 * is the deep link. The architecture doc's "QR with deep-link fallback"
 * means Phase 1 has the fallback live; Phase 4 lands the QR encoder.
 *
 * jsdom-friendly: the popover is plain HTML + inline SVG, no R3F, no
 * `<Canvas>` — render-only in jsdom is trivial.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useSurfaceManager } from '@app/aether-core';
import { buildContinuumUrl, continuumSigilSeed, type ContinuumExtras } from './continuum-state';
import { DEFAULT_SIGIL_SIZE, buildSigilGrid, type SigilGrid } from './continuum-sigil';

export interface Phase1ContinuumBarProps {
  /** Edge to anchor the bar on. Default 'bottom'. */
  readonly edge?: 'bottom' | 'top';
  /** Bar thickness in pixels. Default 4. */
  readonly thicknessPx?: number;
  /** Surface-specific extras the receiving device should restore. */
  readonly extras?: ContinuumExtras;
  /** Override the origin written into the deep link. Default reads
   *  `window.location.origin` in browser, empty in SSR/tests. */
  readonly origin?: string;
  /** Pin the pathname instead of reading from the manager. Tests + the
   *  Storybook fixture pass this; the live overlay defers to the manager. */
  readonly pathname?: string;
  /** Hide the bar entirely (e.g. on a surface that shouldn't show one). */
  readonly hidden?: boolean;
  /** Sigil grid size. Default 21 (visually QR-evocative). */
  readonly sigilSize?: number;
  /** Force-open state for Storybook. Live overlay manages state internally. */
  readonly initialOpen?: boolean;
}

const BAR_Z_INDEX = 11; // below Pulse (12), above scene + Now Card
const POPOVER_Z_INDEX = 13;

export function Phase1ContinuumBar(props: Phase1ContinuumBarProps): React.ReactElement | null {
  const manager = useSurfaceManager();
  const hasContinuum = useMemo(
    () => manager.overlays.some((o) => o.id === 'continuum'),
    [manager.overlays],
  );
  if (!hasContinuum || props.hidden === true) return null;
  return <Phase1ContinuumBarInner {...props} pathname={props.pathname ?? manager.pathname} />;
}

/** Internal — receives the resolved pathname so the outer wrapper can
 *  read from the manager OR a prop override (Storybook / tests). */
function Phase1ContinuumBarInner({
  edge = 'bottom',
  thicknessPx = 4,
  extras,
  origin,
  pathname = '/',
  sigilSize = DEFAULT_SIGIL_SIZE,
  initialOpen = false,
}: Phase1ContinuumBarProps & { pathname: string }): React.ReactElement {
  const [isOpen, setOpen] = useState<boolean>(initialOpen);
  const [copiedTick, setCopiedTick] = useState<boolean>(false);
  const resolvedOrigin = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);

  const state = useMemo(
    () => ({ pathname, ...(extras !== undefined ? { extras } : {}) }),
    [pathname, extras],
  );
  const url = useMemo(() => buildContinuumUrl(state, resolvedOrigin), [state, resolvedOrigin]);
  const seed = useMemo(() => continuumSigilSeed(state), [state]);
  const sigil = useMemo<SigilGrid>(() => buildSigilGrid(seed, sigilSize), [seed, sigilSize]);

  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Esc closes; clicks outside the popover close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent): void => {
      const el = popoverRef.current;
      if (el === null) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return (): void => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [isOpen]);

  const onCopy = useCallback(async (): Promise<void> => {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTick(true);
      window.setTimeout(() => setCopiedTick(false), 1500);
    } catch {
      // Clipboard write can fail (permissions, file://). Silent — the
      // URL is still selectable in the popover for manual copy.
    }
  }, [url]);

  const onShare = useCallback(async (): Promise<void> => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title: 'Continue on another device', url });
    } catch {
      // User cancelled or share unsupported — silent.
    }
  }, [url]);

  const onBarKey = useCallback((e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }, []);

  const barStyle: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: thicknessPx,
    background: 'var(--aether-palette-accent, #C2614A)',
    opacity: isOpen ? 0.95 : 0.55,
    zIndex: BAR_Z_INDEX,
    cursor: 'pointer',
    transition: 'opacity 180ms ease',
    [edge]: 0,
  };

  const popoverStyle: CSSProperties = {
    position: 'fixed',
    [edge === 'bottom' ? 'bottom' : 'top']: thicknessPx + 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: POPOVER_Z_INDEX,
    minWidth: 280,
    maxWidth: 360,
    padding: '14px 16px',
    borderRadius: 12,
    background: 'var(--aether-palette-surface, #F2E8D5)',
    color: 'var(--aether-palette-ink, #1A0F09)',
    border: '1px solid var(--aether-palette-glow, #E8B777)',
    boxShadow: '0 18px 60px rgba(0, 0, 0, 0.35)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Continue on another device"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        data-aether-continuum-bar
        data-aether-continuum-edge={edge}
        style={barStyle}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onBarKey}
      />
      {isOpen && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-modal="false"
          aria-label="Cross-device handoff"
          data-aether-continuum-popover
          style={popoverStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--aether-palette-accent, #C2614A)',
                fontWeight: 600,
              }}
            >
              Continue on another device
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={closeButtonStyle}
            >
              ×
            </button>
          </div>
          <ContinuumSigilSvg grid={sigil} sizePx={140} color="var(--aether-palette-ink, #1A0F09)" />
          <code
            data-aether-continuum-url
            style={{
              fontSize: 11,
              padding: '8px 10px',
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: 6,
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {url}
          </code>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              data-aether-continuum-copy
              onClick={() => {
                void onCopy();
              }}
              style={primaryButtonStyle}
            >
              {copiedTick ? '✓ Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              data-aether-continuum-share
              onClick={() => {
                void onShare();
              }}
              style={secondaryButtonStyle}
            >
              Share…
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--aether-palette-ink, #1A0F09)',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 4,
};

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  padding: '7px 10px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--aether-palette-accent, #C2614A)',
  color: 'var(--aether-palette-surface, #F2E8D5)',
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'transparent',
  border: '1px solid var(--aether-palette-accent, #C2614A)',
  color: 'var(--aether-palette-accent, #C2614A)',
};

/** Inline SVG render of the boolean sigil grid. Pure, no React state. */
function ContinuumSigilSvg({
  grid,
  sizePx,
  color,
}: {
  grid: SigilGrid;
  sizePx: number;
  color: string;
}): React.ReactElement {
  const rows = grid.length;
  const cols = rows === 0 ? 0 : (grid[0]?.length ?? 0);
  if (rows === 0 || cols === 0) {
    return <svg width={sizePx} height={sizePx} data-aether-continuum-sigil />;
  }
  const cells: React.ReactElement[] = [];
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    if (row === undefined) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === true) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />);
      }
    }
  }
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      data-aether-continuum-sigil
      aria-hidden
      style={{ display: 'block', margin: '0 auto' }}
    >
      {cells}
    </svg>
  );
}
