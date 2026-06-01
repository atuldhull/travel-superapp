'use client';

/**
 * AE414 — Vault Phase 2 R3F scene.
 *
 * Per docs/aether/02-surfaces.md §8 Vault: "prices float as weighted
 * glyphs". AE407 shipped a 2D HTML overlay grid; AE414 lifts the
 * shape story into actual 3D — each price is a sphere on a horizontal
 * ring, sized by amount (via AE414 `glyphSphereScale`), gently bobbing
 * via `glyphFloatY`. A soft emissive halo flags "price dropped
 * recently" via the AE407 `priceDroppedRecently` predicate.
 *
 * The R3F scene mounts via the Aether registry's `mount` loader. The
 * 2D HTML label overlay from AE407 stays mounted in the shell — it
 * carries the numeric copy + sparkline that's not legible at the
 * sphere distance. Future slices can use drei `<Html>` to attach
 * labels to each sphere directly.
 *
 * The component is the default export so the registry's
 * `mount: () => import('./vault-phase2-scene')` can hand it directly
 * to `React.lazy`.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useSurfacePaletteSlots, type SurfaceMountProps } from '@app/aether-core';
import {
  glyphFloatY,
  glyphHaloIntensity,
  glyphRingPosition,
  glyphSphereScale,
} from './vault-glyph-positions';
import { priceDroppedRecently, type VaultPriceLike } from './vault-glyphs';
import {
  SAMPLE_VAULT_MAX_AMOUNT,
  SAMPLE_VAULT_MIN_AMOUNT,
  SAMPLE_VAULT_PRICES,
} from './vault-sample-prices';

export default function VaultPhase2Scene(
  _props: Partial<SurfaceMountProps> = {},
): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  return (
    <>
      {/* Vault lighting — soft ambient + a stronger directional fill
          so the spheres pick up surface highlights. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 10, 8]} intensity={0.7} />

      {/* Ring backdrop — a thin torus rendered at y=0 so the user
          reads "these prices sit on a shared ring". */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[4, 0.04, 8, 64]} />
        <meshStandardMaterial color={palette.support} roughness={0.7} transparent opacity={0.45} />
      </mesh>

      {SAMPLE_VAULT_PRICES.map((p, i) => (
        <VaultGlyph
          key={p.id}
          index={i}
          total={SAMPLE_VAULT_PRICES.length}
          price={p}
          accent={palette.accent}
          glow={palette.glow}
        />
      ))}
    </>
  );
}

function VaultGlyph({
  index,
  total,
  price,
  accent,
  glow,
}: {
  readonly index: number;
  readonly total: number;
  readonly price: VaultPriceLike;
  readonly accent: string;
  readonly glow: string;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const [rx, , rz] = glyphRingPosition(index, total);
  const scale = glyphSphereScale(
    price.amountMinor,
    SAMPLE_VAULT_MIN_AMOUNT,
    SAMPLE_VAULT_MAX_AMOUNT,
  );
  const dropped = price.history !== undefined && priceDroppedRecently(price.history);
  const halo = glyphHaloIntensity(dropped);

  useFrame((state) => {
    const g = groupRef.current;
    if (g === null) return;
    g.position.y = glyphFloatY(index, state.clock.elapsedTime);
    // Gentle spin so highlights move; slow enough not to be distracting.
    g.rotation.y += 0.005;
  });

  return (
    <group ref={groupRef} position={[rx, 0, rz]} scale={scale}>
      <mesh>
        <sphereGeometry args={[1, 36, 24]} />
        <meshStandardMaterial
          color={accent}
          emissive={dropped ? glow : '#000000'}
          emissiveIntensity={halo}
          roughness={0.5}
          metalness={0.18}
        />
      </mesh>
    </group>
  );
}
