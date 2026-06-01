'use client';

/**
 * AE418/AE419 — Echo Phase 3 R3F scene.
 *
 * Per docs/aether/02-surfaces.md §6 Echo, the user-facing feed is a
 * vertical-scroll TikTok-style stack of moments-from-someone's-trip;
 * each echo is a photo + 1-sentence diary entry. The R3F scene here
 * renders one large textured plane per echo, stacked vertically along
 * the Y axis. The shell's HTML overlay carries the diary copy + swipe
 * affordances; AE420 wires the live palette re-derivation.
 *
 * AE418 ships an empty registry-mountable scene so the registry's
 * `mount` import resolves; AE419 fills it in with the textured plane
 * stack + per-echo lerp.
 */
import { useSurfacePaletteSlots, type SurfaceMountProps } from '@app/aether-core';
import { useEchoFeed } from './echo-context';

export default function EchoPhase3Scene(
  _props: Partial<SurfaceMountProps> = {},
): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const { items } = useEchoFeed();
  return (
    <>
      {/* Soft ambient + a directional fill so the textured planes
          render with depth without flattening the dominant colour. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={0.55} />

      {/* AE418 first-cut anchor — a single rectangle tinted with the
          current palette accent so the surface reads as "live" even
          before AE419 fills in the per-echo plane stack. */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[6, 3.5]} />
        <meshStandardMaterial color={palette.accent} roughness={0.7} transparent opacity={0.18} />
      </mesh>

      {/* AE418 — small floating disk per echo so the spec's "stack of
          moments" shape is visible. AE419 swaps these for real textured
          planes via `<PhotoPlane>` + per-echo lerp. */}
      {items.map((item, i) => {
        const y = -i * 0.6 + 1.5;
        return (
          <mesh key={item.id} position={[0, y, -0.5]}>
            <circleGeometry args={[0.18, 24]} />
            <meshStandardMaterial color={palette.glow} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}
