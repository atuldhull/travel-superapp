/**
 * `<AetherContinuumSigil/>` — the second Aether mobile surface (Phase 4 AE531).
 *
 * Per the AR-locked renderer policy
 * (`@app/aether-canvas-native/src/renderer-policy.ts`, Phase 4
 * decision #2): Continuum, like Pulse, is a flat surface that renders
 * with **Skia** rather than R3F-native. `<AetherPulseGlow/>` (AE526)
 * was the first Skia surface; this is the second.
 *
 * The sigil is the cross-device handoff visual described in
 * `docs/aether/02-surfaces.md` section 10 (Continuum): the receiving
 * device shows a deterministic, QR-evocative identifier alongside the
 * deep-link URL so the sender can confirm at a glance "yes, this is my
 * handoff, not someone else's". The grid is the **same pure helper**
 * the web Continuum bar renders as SVG — `buildSigilGrid(seed, size)`
 * from `@app/aether-canvas-shared` — so the web SVG sigil and this
 * mobile Skia sigil are byte-for-byte identical for a given seed
 * (`sigilEquals` pins that invariant).
 *
 * AE531 ships the static surface only:
 *   - The sigil does **not** breathe — there is no `requestAnimationFrame`
 *     loop. It paints once per `(seed, size, cellPx, gapPx)` tuple.
 *   - No surface manager wiring yet (seed is a prop). Once mobile
 *     consumes `@app/aether-core-native` we'll derive the seed from
 *     `continuumSigilSeed(useContinuumState())` instead of a prop.
 *   - No real QR encoder yet — the architecture doc reserves
 *     `@app/aether/continuum` for the Phase 4 scannable swap. The deep
 *     link displayed beside the sigil remains the actual handoff.
 *
 * Drop it inside whatever Continuum popover / sheet renders the
 * deep-link URL. It sizes itself to the painted pixel extent
 * (`sigilPixelSize`) so the parent can lay it out without knowing the
 * grid dimensions.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  sigilCellRects,
  sigilPixelSize,
  type SigilCellRect,
} from '@app/aether-canvas-shared';
import { AETHER_INK } from './palette';

/** Default edge length (px) of a single sigil cell. 6 px keeps the
 *  default 21x21 grid at a comfortable ~146 px square (21 cells x 6 px
 *  + 20 gaps x 1 px) for an in-sheet handoff identifier. */
const DEFAULT_CELL_PX = 6;

/** Default gap (px) between cells. 1 px reads as the classic QR module
 *  separation without the grid looking sparse. */
const DEFAULT_GAP_PX = 1;

/** Warm Italian ink — the locked AE foreground. Empty cells stay
 *  transparent (we only paint filled cells), so the parent's surface
 *  shows through the gaps. */
const DEFAULT_FILL = AETHER_INK;

export interface AetherContinuumSigilProps {
  /** The handoff seed — typically the Continuum deep-link URL (or
   *    `continuumSigilSeed(state)`). Same seed â†’ byte-for-byte same grid. */
  seed: string;
  /** Grid dimension (cells per side). Defaults to `DEFAULT_SIGIL_SIZE`
   *    (21, matching QR version 1) so the Phase 4 real-QR swap is a
   *    drop-in. */
  size?: number;
  /** Edge length (px) of a single cell. Defaults to `DEFAULT_CELL_PX`. */
  cellPx?: number;
  /** Gap (px) between cells. Defaults to `DEFAULT_GAP_PX`. */
  gapPx?: number;
  /** Filled-cell colour. Defaults to Warm Italian ink `#1A1714`. */
  fill?: string;
  /** Background fill behind the grid. Defaults to `'transparent'` so the
   *    parent surface shows through. */
  background?: string;
}

/**
 * Static Continuum handoff sigil. Paints the filled cells of
 * `buildSigilGrid(seed, size)` as Skia `<Rect>`s.
 *
 * The component does no animation and owns no timers — the sigil is a
 * fixed visual identifier, not a breathing surface. It recomputes only
 * when `(seed, size, cellPx, gapPx)` change.
 */
export function AetherContinuumSigil({
  seed,
  size = DEFAULT_SIGIL_SIZE,
  cellPx = DEFAULT_CELL_PX,
  gapPx = DEFAULT_GAP_PX,
  fill = DEFAULT_FILL,
  background = 'transparent',
}: AetherContinuumSigilProps): React.ReactElement {
  const { rects, pixelSize } = useMemo(() => {
    const grid = buildSigilGrid(seed, size);
    return {
      rects: sigilCellRects(grid, cellPx, gapPx),
      pixelSize: sigilPixelSize(grid, cellPx, gapPx),
    };
  }, [seed, size, cellPx, gapPx]);

  // Only paint filled cells — empty cells stay transparent so the
  // parent surface (and the `background` view fill) shows through.
  const filled = useMemo(() => rects.filter((r: SigilCellRect) => r.filled), [rects]);

  return (
    <View
      style={[
        styles.container,
        { width: pixelSize, height: pixelSize, backgroundColor: background },
      ]}
      testID="aether-continuum-sigil"
      accessibilityRole="image"
      accessibilityLabel={`Aether Continuum handoff sigil for ${seed}`}
    >
      <Canvas style={{ width: pixelSize, height: pixelSize }}>
        <Group>
          {filled.map((r: SigilCellRect) => (
            <Rect
              key={`${r.x}:${r.y}`}
              x={r.x}
              y={r.y}
              width={r.size}
              height={r.size}
              color={fill}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
