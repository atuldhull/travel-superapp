/**
 * <SunDisk> — Drift's hero element.
 *
 * A flat circle billboarded toward the camera, gradient-shaded from
 * ochre at the centre to terracotta at the rim. Slowly rotates and
 * pulses on the `breath` spring's timing. This is the "sun on the
 * piazza" that the Warm Italian palette earns.
 *
 * No texture; pure-shader so it stays sharp at any DPR and has zero
 * bandwidth cost.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial, Mesh } from 'three';
import { Color } from 'three';
import { useTheme, useMotionPolicy } from '@app/aether-core';

export interface SunDiskProps {
  /** World-space radius. Default 1.8. */
  radius?: number;
  /** XYZ position. Default [0, 0.4, 0]. */
  position?: readonly [number, number, number];
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uInner;
  uniform vec3 uOuter;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    // Soft falloff: 0 at centre → 1 at rim, smoothed.
    float t = smoothstep(0.0, 1.0, d);
    // Slow breathing pulse on the falloff.
    float breath = 0.5 + 0.5 * sin(uTime * 0.5);
    t = mix(t, t * 0.85 + 0.07 * breath, 0.6);
    // Alpha falls off past r=1; gives the soft disk edge.
    float alpha = smoothstep(1.0, 0.78, d);
    vec3 col = mix(uInner, uOuter, t);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function SunDisk({
  radius = 1.8,
  position = [0, 0.4, 0],
}: SunDiskProps): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInner: { value: new Color(theme.palette.ochre.glow) },
      uOuter: { value: new Color(theme.palette.terracotta.glow) },
    }),
    [theme.palette.ochre.glow, theme.palette.terracotta.glow],
  );

  useFrame((state) => {
    if (matRef.current === null) return;
    // Freeze at t=0 when motion suppressed.
    const t = motionPolicy === 'full' ? state.clock.elapsedTime : 0;
    matRef.current.uniforms['uTime']!.value = t;
    if (meshRef.current !== null && motionPolicy === 'full') {
      // Slow rotation — about 1 full turn per ~4 minutes.
      meshRef.current.rotation.z = t * 0.025;
    }
  });

  return (
    <mesh ref={meshRef} position={[...position]}>
      <circleGeometry args={[radius, 96]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
