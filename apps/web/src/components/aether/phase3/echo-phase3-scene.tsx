'use client';

/**
 * AE418/AE419 — Echo Phase 3 R3F scene.
 *
 * Per docs/aether/02-surfaces.md §6 Echo: vertical-scroll feed of
 * photo + diary moments. AE419 fills in the textured-plane stack —
 * the active echo sits at world y=0; previous echoes float above
 * (y > 0); upcoming echoes wait below (y < 0). The whole stack lerps
 * upward as the active index advances, giving a TikTok-style scroll.
 *
 * Cards 2+ rows away from the active are not rendered to keep the
 * texture budget bounded. The HTML diary overlay (in the shell)
 * stays anchored to the screen so the diary copy is always legible.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PhotoPlane, lerp } from '@app/aether-canvas';
import { useSurfacePaletteSlots, type SurfaceMountProps } from '@app/aether-core';
import { useEchoFeed } from './echo-context';
import {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardY,
  visibleEchoSlots,
} from './echo-layout';

export default function EchoPhase3Scene(
  _props: Partial<SurfaceMountProps> = {},
): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const { items, activeIndex } = useEchoFeed();
  const slots = useMemo(() => visibleEchoSlots(items, activeIndex), [items, activeIndex]);
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={0.55} />
      {slots.map((slot) => (
        <EchoCard
          key={slot.item.id}
          index={slot.index}
          activeIndex={activeIndex}
          photoUrl={slot.item.photoUrl}
          fallbackColor={palette.glow}
          borderColor={palette.accent}
        />
      ))}
    </>
  );
}

/** Per-card render. The outer group lerps to `targetY` based on the
 *  active index; the inner `<PhotoPlane>` carries the texture + the
 *  per-card opacity/scale derived from offset. */
function EchoCard({
  index,
  activeIndex,
  photoUrl,
  fallbackColor,
  borderColor,
}: {
  readonly index: number;
  readonly activeIndex: number;
  readonly photoUrl: string | null;
  readonly fallbackColor: string;
  readonly borderColor: string;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const targetY = echoCardY(index, activeIndex);
  const targetScale = echoCardScale(index, activeIndex);
  const opacity = echoCardOpacity(index, activeIndex);

  useFrame((_state, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    const dt = Math.min(delta, 0.1);
    const t = 1 - Math.exp(-dt * 4.5);
    g.position.y = lerp(g.position.y, targetY, t);
    const currentScale = g.scale.x;
    const nextScale = lerp(currentScale, targetScale, t);
    g.scale.set(nextScale, nextScale, nextScale);
  });

  return (
    <group ref={groupRef} position={[0, targetY, 0]} scale={targetScale}>
      <PhotoPlane
        url={photoUrl}
        size={ECHO_CARD_WIDTH}
        aspect={ECHO_CARD_HEIGHT / ECHO_CARD_WIDTH}
        position={[0, 0, 0]}
        fallbackColor={fallbackColor}
        borderColor={borderColor}
        opacity={opacity}
      />
    </group>
  );
}
