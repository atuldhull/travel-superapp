/**
 * MapErrorBoundary — contains a failure in the optional Vector
 * (MapLibre/PMTiles) renderer so it can never take the page down.
 *
 * The vector map and its libs (maplibre-gl / pmtiles /
 * protomaps-themes-base) are code-split and only loaded when the user
 * toggles "Vector". If that chunk fails to load — most commonly
 * because the dev server hasn't been restarted to pick up the new
 * deps + next.config `transpilePackages` — a rejected dynamic import
 * would otherwise throw through React and blank the whole /navigate
 * route (including the reliable raster map and the journey picker).
 *
 * This boundary catches that, tells the user plainly what to do, and
 * calls `onError` so the page can auto-switch back to the raster map.
 *
 * Installed for the offline-region feature (robustness fix).
 */
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface MapErrorBoundaryProps {
  readonly children: ReactNode;
  /** Called once when a render/runtime error is first caught. */
  readonly onError?: () => void;
  readonly fallback: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class MapErrorBoundary extends Component<MapErrorBoundaryProps, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Surface to the parent so it can fall back to the raster map.
    this.props.onError?.();
  }

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
