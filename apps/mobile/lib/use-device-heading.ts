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

export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<DeviceHeading>(null);

  useEffect(() => {
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
  }, []);

  return heading;
}
