/**
 * Geolocation hook for the Expo runtime.
 *
 * [S-D2] one-call permission-then-read pattern. Returns the user's
 * current coords + a status discriminator the calling screen renders
 * accordingly. NYC fallback matches the web Explore page's posture so
 * the screen demos meaningfully even on simulators / denied permissions.
 *
 * Cached for 60s — re-locate triggers a fresh fix.
 *
 * Installed by [S-D2] of the S-series real-functionality closeout.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

/** Times Square — matches the web Explore + Events default. */
export const DEFAULT_CENTER = { lat: 40.758, lng: -73.9855 } as const;

export type GeoStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable';

export interface Geolocation {
  readonly center: { lat: number; lng: number };
  readonly status: GeoStatus;
  /** True iff `center` came from the OS rather than the fallback. */
  readonly isReal: boolean;
  /** Trigger a fresh permission-prompt + location-fix. */
  readonly relocate: () => Promise<void>;
}

export function useGeolocation(): Geolocation {
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ ...DEFAULT_CENTER });
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [isReal, setIsReal] = useState(false);

  const relocate = useCallback(async () => {
    setStatus('pending');
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        setStatus('unavailable');
        return;
      }
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      // Balanced accuracy = good enough for "discover near me" + cheap on battery.
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        // The 5s timeout is short enough to keep the UI responsive; we
        // surface 'unavailable' on miss so the user knows to retry.
      });
      setCenter({ lat: fix.coords.latitude, lng: fix.coords.longitude });
      setIsReal(true);
      setStatus('granted');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  // First-mount: prompt automatically. Users land on Explore and either
  // grant immediately or see the fallback (NYC) demo data.
  useEffect(() => {
    if (status === 'idle') void relocate();
  }, [status, relocate]);

  return { center, status, isReal, relocate };
}
