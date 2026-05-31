/**
 * `useSceneAudioBridge` — React hook that connects the AE376 mixer
 * output to the AE2 `AudioEngine`.
 *
 * Consumer pattern (in a Phase 1 shell):
 *
 *   const bridge = useSceneAudioBridge((gains) => setAudio(gains));
 *
 *   <SurfaceAudioLayer onChannelWrite={bridge.onChannelWrite} />
 *
 * If `bridge.status === 'awaiting-activation'` the engine still needs a
 * user gesture before Tone.js starts. The shell can use `bridge.activate()`
 * directly, or fall back to the auto-installed pointerdown listener that
 * runs once.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAudioEngine, type AudioEngineStatus } from '@app/aether-core';
import type { ChannelWriteFn } from './surface-audio-layer';
import {
  INITIAL_CHANNEL_SNAPSHOT,
  computeEdgeTransitions,
  hasAnyAction,
  type ChannelSnapshot,
} from './scene-audio-bridge';

export interface SceneAudioBridge {
  /** Hand to `<SurfaceAudioLayer onChannelWrite={...}>`. */
  readonly onChannelWrite: ChannelWriteFn;
  /** Mirror of the engine status — surfaces can show a "tap to enable
   *  sound" hint while this is 'awaiting-activation'. */
  readonly status: AudioEngineStatus;
  /** Idempotent — call from a user gesture handler to start Tone.js. */
  activate(): Promise<void>;
}

/**
 * @param passthrough optional callback the bridge invokes AFTER the
 *   engine routing — typically used by the shell to keep a dev pip
 *   updated with the latest channel gains.
 * @param autoActivateOnPointer when true (default), installs a
 *   one-shot `pointerdown` listener that calls `activate()` the first
 *   time the user clicks anywhere in the document. The autoplay
 *   policy requires SOMETHING like this; the shell can disable it and
 *   wire its own activation gesture if needed.
 */
export function useSceneAudioBridge(
  passthrough?: ChannelWriteFn,
  autoActivateOnPointer: boolean = true,
): SceneAudioBridge {
  const { engine, status } = useAudioEngine();
  const lastSnapshotRef = useRef<ChannelSnapshot>(INITIAL_CHANNEL_SNAPSHOT);

  const onChannelWrite = useCallback<ChannelWriteFn>(
    (gains) => {
      const prev = lastSnapshotRef.current;
      const next: ChannelSnapshot = { drone: gains.drone, events: gains.events };
      lastSnapshotRef.current = next;

      // Engine only acts once it's actually running. Before then, the
      // snapshot still updates so the rising-edge fires the moment the
      // engine wakes up (otherwise the materialise-phase drone fade
      // would be missed if the user clicks mid-phase).
      if (engine.status === 'running') {
        const actions = computeEdgeTransitions(prev, next);
        if (hasAnyAction(actions)) {
          if (actions.startAmbient) engine.startAmbient();
          if (actions.stopAmbient) engine.stopAmbient();
          if (actions.tick) engine.tick();
          if (actions.setMasterDb !== null) engine.setMasterDb(actions.setMasterDb);
        }
      }

      passthrough?.(gains);
    },
    [engine, passthrough],
  );

  // Auto-activation on the first user gesture.
  useEffect(() => {
    if (!autoActivateOnPointer) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (status !== 'awaiting-activation') return undefined;

    const handler = (): void => {
      // The engine's own activate() guard makes this idempotent.
      void engine.activate();
    };
    window.addEventListener('pointerdown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
    };
  }, [autoActivateOnPointer, engine, status]);

  return useMemo<SceneAudioBridge>(
    () => ({
      onChannelWrite,
      status,
      activate: () => engine.activate(),
    }),
    [engine, onChannelWrite, status],
  );
}
