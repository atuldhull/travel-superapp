/**
 * Device compass-heading hook for the Expo runtime (Phase 4 AE563).
 *
 * Subscribes to `expo-location`'s `watchHeadingAsync` and returns the
 * current heading in degrees (0 = north, clockwise). The Aether Compass
 * surface (AE543) accepts a `headingDegrees` prop; this hook is the real
 * device-sensor feed for it. When the heading is unavailable (permission
 * denied, no magnetometer, web) the hook returns `null` and the Compass
 * scene falls back to its self-sweep demo.
 *
 * Prefers `trueHeading` (geographic north, magnetometer + GPS declination
 * correction) when the platform provides it; falls back to `magHeading`
 * (raw magnetic north) otherwise. Both are in [0, 360).
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/** A heading reading in degrees, or null when unavailable. */
export type DeviceHeading = number | null;

/**
 * @param enabled When false the hook does NOT request location
 *   permission or subscribe — so a flag-disabled Compass (which renders
 *   a "not enabled" notice instead of the scene) never triggers an OS
 *   permission prompt (AE576). Defaults to true.
 */
export function useDeviceHeading(enabled: boolean = true): DeviceHeading {
  const [heading, setHeading] = useState<DeviceHeading>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        subscription = await Location.watchHeadingAsync((reading) => {
          if (cancelled) return;
          // trueHeading is -1 when the platform can't correct for
          // declination; fall back to magHeading in that case.
          const value = reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading;
          if (Number.isFinite(value) && value >= 0) setHeading(value);
        });
      } catch {
        if (!cancelled) setHeading(null);
      }
    })();

    return () => {
      cancelled = true;
      if (subscription) subscription.remove();
    };
  }, [enabled]);

  return heading;
}
