/**
 * <DepthFog> — per-surface depth fog primitive.
 *
 * Wraps Three's built-in linear `<fog>` so consumers don't have to import
 * from `three` directly. The default color is the theme's cream surface
 * tone — the same as the AetherScene background — so distant objects fade
 * cleanly into the environment.
 *
 * Use cases:
 *   - Atlas city-block render: prevents the far skyline from feeling cut.
 *   - Compass Bird: route ribbon vanishes into haze beyond ~50m.
 *   - Drift particles: ambient field doesn't pop at the world bounds.
 *
 * Linear fog is GPU-cheap. AE375 ships the linear primitive; exponential
 * fog (`<fogExp2>`) lands later if Mirror needs the heavier feel.
 */
import { useTheme } from '@app/aether-core';

export interface DepthFogProps {
  /** Fog colour. Defaults to theme.color.surface.base (cream). */
  color?: string;
  /** Distance at which fog begins. Default 8. */
  near?: number;
  /** Distance at which fog fully obscures. Default 24. */
  far?: number;
}

export function DepthFog({ color, near = 8, far = 24 }: DepthFogProps): React.ReactElement {
  const theme = useTheme();
  const c = color ?? theme.color.surface.base;
  return <fog attach="fog" args={[c, near, far]} />;
}

/** Pure helper — given a target distance, return the fog density at that
 *  distance for a linear fog [near, far]. Used by surfaces that want to
 *  fade an object's opacity in lockstep with the scene fog.
 *
 *  Returns 0 (no fog) at `near` or closer, 1 (full fog) at `far` or
 *  beyond, linearly between. */
export function linearFogDensity(distance: number, near: number, far: number): number {
  if (far <= near) return 0;
  if (distance <= near) return 0;
  if (distance >= far) return 1;
  return (distance - near) / (far - near);
}
