/**
 * <SurfaceCanvas> — the bridge between `@app/aether-core`'s Surface model
 * (AE374) and this package's R3F primitives.
 *
 * Reads the active Surface + lifecycle phase from `useSurfaceManager()`,
 * wraps an `<AetherScene>` with the right camera pose for that phase, and
 * provides a `<LifecycleCameraDriver>` that drives `useFrame` to interpolate
 * the camera through the phase. AE377 wires the first Drift scene by
 * passing the registered Surface's `mount`-loaded component as children.
 *
 * Why this lives in `@app/aether-canvas` not `@app/aether-core`: it depends
 * on R3F. AE374's `<SurfaceMountFrame>` stays React-only so non-3D surfaces
 * (admin Mirror later, server-rendered fallbacks) can mount surfaces without
 * paying the R3F cost. `<SurfaceCanvas>` is the 3D-flavoured replacement.
 *
 * Consumer pattern:
 *   <SurfaceManagerProvider registry={r}>
 *     <SurfaceCanvas>
 *       <SunDisk />
 *       <AmbientField />
 *     </SurfaceCanvas>
 *   </SurfaceManagerProvider>
 *
 * Or with a registered Surface's mount loader:
 *   const DriftScene = useMemo(() => lazy(driftSurface.mount!), [driftSurface]);
 *   <SurfaceCanvas>
 *     <Suspense fallback={null}><DriftScene .../></Suspense>
 *   </SurfaceCanvas>
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { useSurfaceLifecycle, useCurrentSurface } from '@app/aether-core';
import { AetherScene, type AetherSceneProps } from './aether-scene';
import { DEFAULT_CAMERA_SCRIPT, type CameraScript, cameraPoseAt } from './lifecycle-camera';
import type { LifecyclePhaseDurations } from './lifecycle-progress';

export interface SurfaceCanvasProps extends Omit<AetherSceneProps, 'children'> {
  children?: ReactNode;
  /** Camera script (poses per phase). Defaults to the Drift script. */
  script?: CameraScript;
  /** Phase durations (transient + ambient). Defaults to ~1.2s materialise+settle. */
  durations?: LifecyclePhaseDurations;
  /** When true, the lifecycle camera is disabled and `<AetherScene>` uses
   *  its static `cameraPosition` prop. Useful for Storybook fixtures. */
  disableLifecycleCamera?: boolean;
}

export function SurfaceCanvas({
  children,
  script = DEFAULT_CAMERA_SCRIPT,
  durations,
  disableLifecycleCamera = false,
  ...sceneProps
}: SurfaceCanvasProps): React.ReactElement {
  // The initial camera position matches the lifecycle script's idle pose
  // so the first paint already shows the right camera. AE375's Storybook
  // fixtures bypass this by passing `disableLifecycleCamera`.
  const initialPos: AetherSceneProps['cameraPosition'] =
    sceneProps.cameraPosition ?? script.idle.position;

  return (
    <AetherScene {...sceneProps} cameraPosition={initialPos}>
      {!disableLifecycleCamera && (
        <LifecycleCameraDriver
          script={script}
          {...(durations !== undefined ? { durations } : {})}
        />
      )}
      {children}
    </AetherScene>
  );
}

interface LifecycleCameraDriverProps {
  script: CameraScript;
  durations?: LifecyclePhaseDurations;
}

/** Internal — reads the current Surface lifecycle phase, accumulates time
 *  spent in that phase, and applies the eased camera pose every frame. */
export function LifecycleCameraDriver({ script, durations }: LifecycleCameraDriverProps): null {
  const phase = useSurfaceLifecycle();
  // We watch `current` so a route change re-zeroes the timer even if the
  // FSM stays in idle.
  const current = useCurrentSurface();
  const { camera } = useThree();
  const elapsedRef = useRef<number>(0);
  // Re-zero when phase changes — driven via state so the timer reset is
  // synchronous with the phase prop update inside `useFrame`.
  const [phaseEntered, setPhaseEntered] = useState<number>(0);

  useEffect(() => {
    elapsedRef.current = 0;
    setPhaseEntered((n) => n + 1);
  }, [phase, current]);

  useFrame((_state, delta) => {
    // Cap delta to avoid huge jumps on tab refocus (delta can spike to
    // hundreds of ms after a backgrounded tab resumes).
    const dt = Math.min(delta, 0.1);
    elapsedRef.current += dt;
    const pose = cameraPoseAt(phase, elapsedRef.current, script, durations);
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
    // Keep PerspectiveCamera's projection matrix fresh.
    const persp = camera as PerspectiveCamera;
    if (typeof persp.updateProjectionMatrix === 'function') {
      persp.updateProjectionMatrix();
    }
  });

  // We reference phaseEntered here so React doesn't dead-code it; the
  // counter exists so the effect dep array is honest about phase changes.
  void phaseEntered;
  return null;
}
