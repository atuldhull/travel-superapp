/**
 * V.UX.27 (sub-prompt 3) — deep-link helpers. Outbound: build a
 * `travelapp://...` URL from a route + params (used by share sheets).
 * Inbound: every web URL pattern under `/trips/[id]`,
 * `/memory-books/[id]`, `/inbox`, `/auth/magic-link/[token]` maps
 * directly to the file-based router via app.json:
 *   - scheme `travelapp` → custom-scheme intent
 *   - associatedDomains `applinks:travelsuperapp.local` → iOS UL
 *   - intentFilters host travelsuperapp.local → Android App Links
 *
 * Tested via:
 *   npx uri-scheme open travelapp://trips/abc --android   # or --ios
 *
 * Installed by prompt [V.UX.27].
 */
import * as Linking from 'expo-linking';

const SCHEME = 'travelapp';

/** Build a deep link URL pointing back into the app. */
export function buildDeepLink(path: string, params?: Record<string, string>): string {
  const qs = params
    ? `?${Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')}`
    : '';
  const trimmed = path.replace(/^\//, '');
  return Linking.createURL(`${trimmed}${qs}`, { scheme: SCHEME });
}

/** Tap-handler for surfacing the OS share sheet with a deep link. */
export function tripDeepLink(tripId: string): string {
  return buildDeepLink(`trips/${tripId}`);
}

export function memoryBookDeepLink(bookId: string): string {
  return buildDeepLink(`memory-books/${bookId}`);
}
