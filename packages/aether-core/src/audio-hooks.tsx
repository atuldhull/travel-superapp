/**
 * Audio React hooks — provider + useAudioEngine.
 *
 * Mounts a single engine instance and exposes it via context. The
 * engine is constructed once with the resolved policy: if motion
 * policy is 'none', forceSilent is set.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createAudioEngine,
  type AudioEngine,
  type AudioEngineStatus,
  type AudioEngineConfig,
} from './audio-engine';
import { useMotionPolicy } from './reduced-motion';

export interface AudioEngineContextValue {
  readonly engine: AudioEngine;
  readonly status: AudioEngineStatus;
}

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

export interface AudioEngineProviderProps extends Omit<
  AudioEngineConfig,
  'onStatusChange' | 'forceSilent'
> {
  /** If the user opted out at the settings level, set this true. */
  optOut?: boolean;
  children: ReactNode;
}

export function AudioEngineProvider({
  optOut = false,
  children,
  ...config
}: AudioEngineProviderProps): React.ReactElement {
  const motionPolicy = useMotionPolicy();
  // 'none' motion policy = no audio either. 'essential' still allows audio
  // because confirms count as essential feedback.
  const forceSilent = optOut || motionPolicy === 'none';
  const [status, setStatus] = useState<AudioEngineStatus>(
    forceSilent ? 'silent' : 'awaiting-activation',
  );
  const engineRef = useRef<AudioEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createAudioEngine({
      ...config,
      forceSilent,
      onStatusChange: setStatus,
    });
  }

  // If forceSilent flips at runtime (user opt-out), dispose the engine
  // and replace with a silent one.
  useEffect(() => {
    if (forceSilent && engineRef.current && engineRef.current.status !== 'silent') {
      engineRef.current.dispose();
    }
  }, [forceSilent]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const value = useMemo<AudioEngineContextValue>(
    () => ({ engine: engineRef.current!, status }),
    [status],
  );

  return <AudioEngineContext.Provider value={value}>{children}</AudioEngineContext.Provider>;
}

/** Read the audio engine + status. Throws outside provider. */
export function useAudioEngine(): AudioEngineContextValue {
  const ctx = useContext(AudioEngineContext);
  if (ctx === null) {
    throw new Error('useAudioEngine() called outside <AudioEngineProvider>.');
  }
  return ctx;
}
