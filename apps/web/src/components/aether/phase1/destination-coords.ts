/**
 * Destination coordinates — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE457 so the Phase 4
 * native weather hook consumes identical curated lat/lng map. This
 * file remains so existing imports keep working.
 */
export {
  coordsForDestination,
  curatedCoordSlugs,
  type DestinationCoords,
} from '@app/aether-canvas-shared';
