/**
 * `<AetherVaultScene/>` — the sixth Aether mobile surface, fourth
 * R3F-native one (Phase 4 AE545).
 *
 * Vault is the booking surface (docs/aether/02-surfaces.md section 8):
 * floating price glyphs you tap to book. The 3D glyph ring ships here;
 * the Stripe checkout panel ports in a later slice (the AE415 panel
 * shape + the AE500-spec'd vault-checkout state machine are ready).
 *
 * The ring geometry comes from the SAME pure helpers the web R3F scene
 * uses — `glyphRingPosition` + `glyphFloatY` + `glyphSphereScale` +
 * `glyphHaloIntensity` from `@app/aether-canvas-shared` (AE407, pinned
 * by the AE489 radius invariants + spec'd at AE511). The sample-price
 * catalogue is the shared `SAMPLE_VAULT_PRICES` fixture (AE414, AE500),
 * so the web Vault + this native scene render identical glyph rings.
 *
 * Each glyph:
 *   - sits on the ring at `glyphRingPosition(i, total)`
 *   - bobs vertically via `glyphFloatY(i, t)` (phase-shifted per glyph)
 *   - is sized by `glyphSphereScale(amount, min, max)` so cheaper deals
 *     read smaller
 *   - glows (emissive) when its price dropped recently, via
 *     `glyphHaloIntensity(priceDroppedRecently(history))`
 *
 * A future slice adds tap-to-open-checkout + the real price feed.
 */
import { useMemo, useRef } from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber/native';
import {
  SAMPLE_VAULT_MAX_AMOUNT,
  SAMPLE_VAULT_MIN_AMOUNT,
  SAMPLE_VAULT_PRICES,
  glyphFloatY,
  glyphHaloIntensity,
  glyphRingPosition,
  glyphSphereScale,
  priceDroppedRecently,
  type VaultPriceLike,
} from '@app/aether-canvas-shared';
import type { Group, Mesh } from 'three';
import { VaultCheckoutPanel } from './vault-checkout-panel';

const GLYPH_COLOR = '#E8B777'; // ochre glow
const GLYPH_DROP_COLOR = '#C2614A'; // terracotta — a price that dropped
const BACKGROUND = '#1A1714'; // ink

/** Slow ring rotation (radians / second). */
const RING_RADIANS_PER_SECOND = (2 * Math.PI) / 60;

export interface AetherVaultSceneProps {
  /** Freeze the ring rotation + glyph bob when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** A single floating price glyph. Owns its own bob so each glyph is
 *  phase-shifted independently. */
function PriceGlyph({
  index,
  total,
  price,
  dropped,
  reducedMotion,
  onSelect,
}: {
  index: number;
  total: number;
  price: VaultPriceLike;
  dropped: boolean;
  reducedMotion: boolean;
  onSelect: (price: VaultPriceLike) => void;
}): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  const elapsedRef = useRef<number>(0);

  const [x, , z] = glyphRingPosition(index, total);
  const scale = glyphSphereScale(
    price.amountMinor,
    SAMPLE_VAULT_MIN_AMOUNT,
    SAMPLE_VAULT_MAX_AMOUNT,
  );
  const halo = glyphHaloIntensity(dropped);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (reducedMotion) {
      mesh.position.set(x, 0, z);
      return;
    }
    elapsedRef.current += delta;
    mesh.position.set(x, glyphFloatY(index, elapsedRef.current), z);
  });

  const onClick = useCallback(
    (e: ThreeEvent<unknown>) => {
      e.stopPropagation();
      onSelect(price);
    },
    [onSelect, price],
  );

  return (
    <mesh ref={meshRef} position={[x, 0, z]} scale={scale} onClick={onClick}>
      <sphereGeometry args={[1, 28, 28]} />
      <meshStandardMaterial
        color={dropped ? GLYPH_DROP_COLOR : GLYPH_COLOR}
        emissive={dropped ? GLYPH_DROP_COLOR : GLYPH_COLOR}
        emissiveIntensity={0.25 + halo}
      />
    </mesh>
  );
}

/** The rotating ring of price glyphs. */
function GlyphRing({
  reducedMotion,
  onSelect,
}: {
  reducedMotion: boolean;
  onSelect: (price: VaultPriceLike) => void;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef<number>(0);

  const glyphs = useMemo(
    () =>
      SAMPLE_VAULT_PRICES.map((p, i) => ({
        key: p.id,
        index: i,
        price: p,
        dropped: priceDroppedRecently(p.history ?? []),
      })),
    [],
  );

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (group) group.rotation.y = elapsedRef.current * RING_RADIANS_PER_SECOND;
  });

  return (
    <group ref={groupRef}>
      {glyphs.map((g) => (
        <PriceGlyph
          key={g.key}
          index={g.index}
          total={glyphs.length}
          price={g.price}
          dropped={g.dropped}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

/**
 * The Vault surface scene. Mounts an R3F-native <Canvas> with the
 * floating glyph ring, viewed from slightly above the ring plane.
 */
export function AetherVaultScene({
  reducedMotion = false,
}: AetherVaultSceneProps): React.ReactElement {
  const [selected, setSelected] = useState<VaultPriceLike | null>(null);
  const onSelect = useCallback((price: VaultPriceLike) => setSelected(price), []);
  const onClose = useCallback(() => setSelected(null), []);

  return (
    <View style={styles.container} testID="aether-vault-scene">
      <Canvas camera={{ position: [0, 3.5, 9], fov: 55 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 6]} intensity={0.8} />
        <GlyphRing reducedMotion={reducedMotion} onSelect={onSelect} />
      </Canvas>
      <VaultCheckoutPanel price={selected} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
