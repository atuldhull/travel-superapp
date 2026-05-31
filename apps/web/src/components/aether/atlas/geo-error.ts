/**
 * AE329 — pure interpreter for `navigator.geolocation` failures.
 *
 * `<AtlasCanvas/>` (and any future surface that calls geolocate)
 * inlines a code===1 / message fallback ladder. Lifting makes the
 * mapping unit-testable + reusable. Returns a structured outcome so
 * the caller chooses which slots to surface (status chip vs alert
 * text).
 */

export type GeoStatus = 'denied' | 'unavailable';

export interface GeoErrorInterpretation {
  readonly status: GeoStatus;
  readonly message: string;
}

const DEFAULT_DENIED_MESSAGE = 'Location permission denied. Re-enable it in the URL bar.';
const DEFAULT_UNAVAILABLE_MESSAGE = 'Could not read your location.';

export function interpretGeolocationError(err: unknown): GeoErrorInterpretation {
  // Spec: code 1 = PERMISSION_DENIED. 2 = POSITION_UNAVAILABLE. 3 = TIMEOUT.
  const code =
    err !== null && typeof err === 'object' && 'code' in err
      ? (err as { code: unknown }).code
      : undefined;
  if (code === 1) {
    return { status: 'denied', message: DEFAULT_DENIED_MESSAGE };
  }
  const message = err instanceof Error ? err.message : DEFAULT_UNAVAILABLE_MESSAGE;
  return { status: 'unavailable', message };
}
