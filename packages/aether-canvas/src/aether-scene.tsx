/**
 * <AetherScene> — the root R3F canvas wrapper.
 *
 * Boots WebGPU when available, falls back to WebGL2. Sets up the Aether
 * default lighting rig — warm-key + soft-fill + tilted-back rim, all
 * tuned to render the Warm Italian palette on materials without losing
 * the terracotta hue to over-exposure.
 *
 * Consumers pass <AetherScene>{children}</AetherScene>; the children
 * are R3F primitives (<mesh>, <ambientLight>, etc.) layered on top of
 * the default rig.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from '@app/aether-core';
import { detectRenderer, defaultRenderer, type RendererCapability } from './renderer-capability';

export interface AetherSceneProps {
  children?: ReactNode;
  /** dpr cap; 2 by default to avoid 4k retina meltdown. */
  dprCap?: number;
  /** Background color override. Default: theme.color.surface.base (cream). */
  background?: string;
  /** Camera position [x, y, z]. Default [0, 0, 6]. */
  cameraPosition?: readonly [number, number, number];
  /** Field of view in degrees. Default 50. */
  cameraFov?: number;
  /** Called once renderer detection completes. */
  onRendererReady?: (cap: RendererCapability) => void;
  /** Aria-label for the canvas — Aether scenes are decorative-with-meaning,
   *  so set this to describe the scene's intent. */
  ariaLabel?: string;
}

export function AetherScene({
  children,
  dprCap = 2,
  background,
  cameraPosition = [0, 0, 6],
  cameraFov = 50,
  onRendererReady,
  ariaLabel = 'Aether decorative scene',
}: AetherSceneProps): React.ReactElement {
  const theme = useTheme();
  const [renderer, setRenderer] = useState<RendererCapability>(() => defaultRenderer());

  useEffect(() => {
    let cancelled = false;
    void detectRenderer().then((cap) => {
      if (cancelled) return;
      setRenderer(cap);
      onRendererReady?.(cap);
    });
    return () => {
      cancelled = true;
    };
  }, [onRendererReady]);

  const bg = background ?? theme.color.surface.base;

  return (
    <Canvas
      dpr={[1, dprCap]}
      camera={{ position: [...cameraPosition], fov: cameraFov }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: bg }}
      role="img"
      aria-label={ariaLabel}
      data-aether-renderer={renderer.mode}
    >
      {/* Warm-key — terracotta-toned directional light, the sun. */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.4}
        color={theme.palette.terracotta.glow}
      />
      {/* Soft-fill — cream-toned ambient, never overpowers. */}
      <ambientLight intensity={0.35} color={theme.palette.cream.glow} />
      {/* Rim — olive-toned point from behind, gives 3D depth without
          contaminating skin tones (Phase 1 Atlas needs this). */}
      <pointLight position={[-6, 2, -5]} intensity={0.6} color={theme.palette.olive.glow} />
      {children}
    </Canvas>
  );
}
