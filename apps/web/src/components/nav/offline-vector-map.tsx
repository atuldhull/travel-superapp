/**
 * OfflineVectorMap — an Organic-Maps-class vector renderer with true
 * on-device offline: download the area, locate via device GPS, and
 * reroute on a wrong turn — all with zero connectivity.
 *
 * MapLibre GL (BSD, open) drawing OpenStreetMap **vector** tiles from
 * a **Protomaps PMTiles** archive via the `pmtiles://` protocol — the
 * exact architecture Organic Maps / Maps.me use. The protocol is
 * registered through an IndexedDB byte-range cache (see
 * `lib/offline-region`), so a "Download this area" pass makes the
 * region work fully offline.
 *
 * Offline navigation, honestly:
 *  - position comes from the browser Geolocation API (`watchPosition`),
 *    which on GPS-capable hardware works without any signal;
 *  - if the traveller leaves the active route, a corrected route is
 *    computed on-device from the rendered road geometry (see
 *    `lib/offline-router`) — geometric shortest-path over OSM lines,
 *    bounded to the downloaded area (no turn restrictions / traffic).
 *
 * Drop-in for LiveNavMap (same props). The raster Leaflet map stays
 * the default + fallback, so a MapLibre/tiles hiccup never strands
 * the user — this view shows a calm message instead of breaking.
 *
 * Client + WebGL only — load via next/dynamic({ ssr:false }).
 *
 * Installed for the offline-vector-map feature; on-device offline
 * (download + GPS + reroute) added for the offline-region feature.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { layers, namedTheme } from 'protomaps-themes-base';
import type { NavRoute, TrafficLevel } from '../../lib/two-oh-api';
import { cn } from '../../lib/cn';
import { installOfflinePmtiles, PMTILES_URL, type RegionBBox } from '../../lib/offline-region';
import {
  buildRoadGraph,
  distanceToPathMeters,
  shortestPath,
  type LngLat,
} from '../../lib/offline-router';
import { OfflineRegionControl } from './offline-region-control';

const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  free: '#15b371',
  moderate: '#d99a2b',
  heavy: '#e8702a',
  blocked: '#dc2626',
};
const GOLD = '#cdab63';
const PROTO_ASSETS = 'https://protomaps.github.io/basemaps-assets';

// Off-route tuning. A reroute fires only after the traveller is
// clearly off (not a single noisy fix), and recomputes at most once
// per cooldown so the device isn't pegged.
const OFFROUTE_M = 45;
const BACK_ON_M = 25;
const MIN_OFF_FIXES = 3;
const REROUTE_COOLDOWN_MS = 6000;
// Protomaps `roads` kinds we treat as drivable for offline rerouting.
const DRIVABLE = new Set(['highway', 'major_road', 'medium_road', 'minor_road', 'other']);

export interface OfflineVectorMapProps {
  readonly routes: readonly NavRoute[];
  readonly selectedRouteId: string;
  readonly recommendedRouteId: string;
  readonly onSelectRoute: (id: string) => void;
  readonly showLiveLocation?: boolean;
  /**
   * Optional start view. When given (e.g. "use my location" with no
   * route yet), the map opens here instead of the whole world — so
   * "Download this area" caches somewhere sensible and GPS has context.
   */
  readonly center?: { readonly lat: number; readonly lng: number };
  readonly className?: string;
}

function pinEl(bg: string, glyph: string, ring: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px 9999px 9999px 2px;transform:rotate(-45deg);background:${bg};box-shadow:0 0 0 3px ${ring},0 4px 12px rgba(0,0,0,.5)`;
  el.innerHTML = `<span style="transform:rotate(45deg);color:#fff;font:700 12px ui-sans-serif,system-ui">${glyph}</span>`;
  return el;
}

function meEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    'width:18px;height:18px;border-radius:9999px;background:#cdab63;box-shadow:0 0 0 3px rgba(205,171,99,.35),0 0 12px 3px rgba(205,171,99,.6)';
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && typeof el.animate === 'function') {
    el.animate(
      [
        { boxShadow: '0 0 0 3px rgba(205,171,99,.35),0 0 0 0 rgba(205,171,99,.55)' },
        { boxShadow: '0 0 0 3px rgba(205,171,99,.35),0 0 0 16px rgba(205,171,99,0)' },
      ],
      { duration: 1800, iterations: Infinity, easing: 'ease-out' },
    );
  }
  return el;
}

// Pull drivable road polylines from the currently-rendered vector
// tiles. Prefers driving kinds; widens (everything but rail/ferry/
// path) if that yields nothing so a reroute is still possible.
function roadLinesFromMap(map: maplibregl.Map): LngLat[][] {
  let feats: ReturnType<maplibregl.Map['querySourceFeatures']> = [];
  try {
    feats = map.querySourceFeatures('protomaps', { sourceLayer: 'roads' });
  } catch {
    return [];
  }
  const collect = (predicate: (kind: string) => boolean): LngLat[][] => {
    const lines: LngLat[][] = [];
    for (const f of feats) {
      const kind = String((f.properties as Record<string, unknown>)?.['kind'] ?? '');
      if (!predicate(kind)) continue;
      const g = f.geometry;
      if (g.type === 'LineString') {
        lines.push(g.coordinates.map((c) => [c[0]!, c[1]!] as LngLat));
      } else if (g.type === 'MultiLineString') {
        for (const part of g.coordinates) {
          lines.push(part.map((c) => [c[0]!, c[1]!] as LngLat));
        }
      }
    }
    return lines;
  };
  const drivable = collect((k) => DRIVABLE.has(k));
  if (drivable.length > 0) return drivable;
  return collect((k) => k !== 'rail' && k !== 'ferry' && k !== 'path');
}

export function OfflineVectorMap({
  routes,
  selectedRouteId,
  showLiveLocation,
  center,
  className,
}: OfflineVectorMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // Live-navigation state (refs so the geolocation callback stays
  // stable and doesn't re-subscribe on every fix).
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);
  const activeCoordsRef = useRef<LngLat[]>([]);
  const rerouteCoordsRef = useRef<LngLat[]>([]);
  const offCountRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const centeredRef = useRef(false);
  const [gps, setGps] = useState<'idle' | 'live' | 'rerouted' | 'noroute' | 'denied'>('idle');

  // One-time map init.
  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    installOfflinePmtiles();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: wrapRef.current,
        style: {
          version: 8,
          glyphs: `${PROTO_ASSETS}/fonts/{fontstack}/{range}.pbf`,
          sprite: `${PROTO_ASSETS}/sprites/v4/dark`,
          sources: {
            protomaps: {
              type: 'vector',
              url: `pmtiles://${PMTILES_URL}`,
              attribution: '© OpenStreetMap · Protomaps',
            },
          },
          layers: layers('protomaps', namedTheme('dark')) as maplibregl.LayerSpecification[],
        },
        center: center ? [center.lng, center.lat] : [0, 20],
        zoom: center ? 12 : 1.4,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', (e) => {
      // A tile/style failure shouldn't blank the UI — surface calmly.
      if (e?.error && /pmtiles|tile|style/i.test(String(e.error.message ?? ''))) {
        setFailed(true);
      }
    });
    map.on('load', () => {
      readyRef.current = true;
      draw();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the selected route + markers whenever data changes.
  useEffect(() => {
    if (readyRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedRouteId]);

  // Follow a changing `center` when there's no route to frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center || routes.length > 0 || !readyRef.current) return;
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: Math.max(map.getZoom(), 12),
      duration: 600,
    });
  }, [center, routes.length]);

  // Device-GPS watch: live position + on-device off-route reroute.
  useEffect(() => {
    if (!showLiveLocation || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }
    const id = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    });
    return () => {
      navigator.geolocation.clearWatch(id);
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      centeredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLiveLocation]);

  function onGeoError(err: GeolocationPositionError): void {
    setGps(err.code === err.PERMISSION_DENIED ? 'denied' : 'idle');
  }

  function setRerouteData(coords: LngLat[]): void {
    const map = mapRef.current;
    if (!map) return;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        coords.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: coords.map((c) => [c[0], c[1]]),
                },
              },
            ]
          : [],
    };
    const src = map.getSource('reroute') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    else map.addSource('reroute', { type: 'geojson', data: fc });
    if (!map.getLayer('reroute-l')) {
      map.addLayer({
        id: 'reroute-l',
        type: 'line',
        source: 'reroute',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#22d3ee',
          'line-width': 5,
          'line-dasharray': [1.5, 1.2],
        },
      });
    }
  }

  function tryReroute(me: LngLat): void {
    const map = mapRef.current;
    const dest = activeCoordsRef.current[activeCoordsRef.current.length - 1];
    if (!map || !dest) return;
    const now = Date.now();
    if (now - lastRerouteAtRef.current < REROUTE_COOLDOWN_MS) return;
    lastRerouteAtRef.current = now;
    try {
      const graph = buildRoadGraph(roadLinesFromMap(map));
      const path = shortestPath(graph, me, dest);
      if (path && path.length >= 2) {
        rerouteCoordsRef.current = path;
        setRerouteData(path);
        setGps('rerouted');
      } else {
        setGps('noroute');
      }
    } catch {
      setGps('noroute');
    }
  }

  function onPosition(p: GeolocationPosition): void {
    const map = mapRef.current;
    if (!map) return;
    const me: LngLat = [p.coords.longitude, p.coords.latitude];
    const mePt: [number, number] = [me[0], me[1]];

    if (!meMarkerRef.current) {
      meMarkerRef.current = new maplibregl.Marker({ element: meEl() }).setLngLat(mePt).addTo(map);
    } else {
      meMarkerRef.current.setLngLat(mePt);
    }
    if (!centeredRef.current) {
      centeredRef.current = true;
      map.easeTo({ center: mePt, zoom: Math.max(map.getZoom(), 14), duration: 900 });
    }
    if (gps === 'idle' || gps === 'denied') setGps('live');

    // Compare against the reroute if one is active, else the route.
    const onReroute = rerouteCoordsRef.current.length >= 2;
    const path = onReroute ? rerouteCoordsRef.current : activeCoordsRef.current;
    if (path.length < 2) return;

    const d = distanceToPathMeters(me, path);
    if (d > OFFROUTE_M) {
      offCountRef.current += 1;
      if (offCountRef.current >= MIN_OFF_FIXES) tryReroute(me);
      return;
    }
    offCountRef.current = 0;
    // Back on the original line — drop the offline detour.
    if (onReroute && distanceToPathMeters(me, activeCoordsRef.current) <= BACK_ON_M) {
      rerouteCoordsRef.current = [];
      setRerouteData([]);
      setGps('live');
    }
  }

  function draw(): void {
    const map = mapRef.current;
    if (!map) return;
    const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    // A new plan/route invalidates any offline detour.
    rerouteCoordsRef.current = [];
    offCountRef.current = 0;
    setRerouteData([]);
    if (!selected || selected.geometry.length < 2) return;

    const coords = selected.geometry.map((p) => [p.lng, p.lat] as [number, number]);
    activeCoordsRef.current = coords.map((c) => [c[0], c[1]] as LngLat);
    const segs =
      selected.trafficSegments.length > 0
        ? selected.trafficSegments
        : [{ fromIndex: 0, toIndex: coords.length - 1, level: 'free' as TrafficLevel }];
    const fc = {
      type: 'FeatureCollection' as const,
      features: segs
        .map((s) => ({
          type: 'Feature' as const,
          properties: { color: TRAFFIC_COLOR[s.level] },
          geometry: {
            type: 'LineString' as const,
            coordinates: coords.slice(s.fromIndex, Math.min(coords.length, s.toIndex + 2)),
          },
        }))
        .filter((f) => f.geometry.coordinates.length >= 2),
    };
    const casing = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: coords },
        },
      ],
    };

    const setSrc = (id: string, data: GeoJSON.FeatureCollection): void => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        map.addSource(id, { type: 'geojson', data });
      }
    };
    setSrc('route-casing', casing as GeoJSON.FeatureCollection);
    setSrc('route', fc as GeoJSON.FeatureCollection);
    if (!map.getLayer('route-casing-l')) {
      map.addLayer({
        id: 'route-casing-l',
        type: 'line',
        source: 'route-casing',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': GOLD, 'line-width': 9, 'line-opacity': 0.25 },
      });
    }
    if (!map.getLayer('route-l')) {
      map.addLayer({
        id: 'route-l',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
      });
    }

    const a = coords[0]!;
    const b = coords[coords.length - 1]!;
    markersRef.current.push(
      new maplibregl.Marker({ element: pinEl('#1d2850', 'A', 'rgba(205,171,99,.5)') })
        .setLngLat(a)
        .addTo(map),
      new maplibregl.Marker({ element: pinEl('#3a2d57', 'B', 'rgba(205,171,99,.5)') })
        .setLngLat(b)
        .addTo(map),
    );
    for (const adv of selected.advisories) {
      if (adv.kind === 'blockage' && adv.atLat != null && adv.atLng != null) {
        markersRef.current.push(
          new maplibregl.Marker({ element: pinEl('#dc2626', '!', 'rgba(220,38,38,.4)') })
            .setLngLat([adv.atLng, adv.atLat])
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText(adv.message))
            .addTo(map),
        );
      }
    }

    let minX = coords[0]![0];
    let minY = coords[0]![1];
    let maxX = minX;
    let maxY = minY;
    for (const [x, y] of coords) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 56, maxZoom: 14, duration: 800 },
    );
  }

  function viewportBBox(): RegionBBox | null {
    const map = mapRef.current;
    if (!map) return null;
    const b = map.getBounds();
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  }

  const gpsLabel: Record<typeof gps, string | null> = {
    idle: null,
    live: '● Live GPS',
    rerouted: '↻ Rerouted offline',
    noroute: 'Off route — download this area to reroute',
    denied: 'Location blocked — enable to navigate',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-600/20 bg-surface shadow-(--shadow-depth-2)',
        className,
      )}
    >
      <div ref={wrapRef} className="absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-gold-500/40 bg-black/55 px-3 py-1 text-xs font-medium text-gold-200 backdrop-blur-sm">
        Vector · offline-capable (OSM/Protomaps)
      </span>
      {showLiveLocation && gpsLabel[gps] ? (
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-12 z-10 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm',
            gps === 'rerouted'
              ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
              : gps === 'noroute' || gps === 'denied'
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                : 'border-gold-500/40 bg-black/55 text-gold-200',
          )}
        >
          {gpsLabel[gps]}
        </span>
      ) : null}
      <div className="absolute bottom-3 left-3 z-10">
        <OfflineRegionControl getBBox={viewportBBox} />
      </div>
      {failed ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-surface/95 p-6 text-center">
          <p className="max-w-xs text-sm text-muted">
            Vector tiles couldn&apos;t load here. Switch to the <strong>Raster</strong> map — it
            works offline-free. (Self-host a regional{' '}
            <code className="font-mono text-xs">.pmtiles</code> for true full-offline.)
          </p>
        </div>
      ) : null}
    </div>
  );
}
