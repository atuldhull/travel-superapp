/**
 * OfflineVectorMap — an Organic-Maps-class vector renderer.
 *
 * MapLibre GL (BSD, open) drawing OpenStreetMap **vector** tiles from
 * a **Protomaps PMTiles** archive via the `pmtiles://` protocol — the
 * exact architecture Organic Maps / Maps.me use. GPU vector tiles =
 * smooth pitch/zoom/rotate, and the Protomaps "dark" theme matches
 * the app's royal ink palette.
 *
 * "Offline-capable", honestly: PMTiles serves only the tiles you
 * actually view via HTTP range requests, which the browser caches —
 * so revisited areas keep working without a connection. For TRUE
 * full-offline, point `NEXT_PUBLIC_PMTILES_URL` at a self-hosted
 * regional `.pmtiles` extract (one file, $0, no tile server). The
 * default is Protomaps' public planet demo bucket so it works out of
 * the box.
 *
 * Drop-in for LiveNavMap (same props). The raster Leaflet map stays
 * the default + fallback, so a MapLibre/tiles hiccup never strands
 * the user — this view shows a calm message instead of breaking.
 *
 * Client + WebGL only — load via next/dynamic({ ssr:false }).
 *
 * Installed for the offline-vector-map feature.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers, namedTheme } from 'protomaps-themes-base';
import type { NavRoute, TrafficLevel } from '../../lib/two-oh-api';
import { cn } from '../../lib/cn';

const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  free: '#15b371',
  moderate: '#d99a2b',
  heavy: '#e8702a',
  blocked: '#dc2626',
};
const GOLD = '#cdab63';
const PMTILES_URL =
  process.env['NEXT_PUBLIC_PMTILES_URL'] ?? 'https://demo-bucket.protomaps.com/v4.pmtiles';
const PROTO_ASSETS = 'https://protomaps.github.io/basemaps-assets';

// Register the pmtiles:// protocol once per page.
let pmtilesReady = false;
function ensurePmtiles(): void {
  if (pmtilesReady) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesReady = true;
}

export interface OfflineVectorMapProps {
  readonly routes: readonly NavRoute[];
  readonly selectedRouteId: string;
  readonly recommendedRouteId: string;
  readonly onSelectRoute: (id: string) => void;
  readonly showLiveLocation?: boolean;
  readonly className?: string;
}

function pinEl(bg: string, glyph: string, ring: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px 9999px 9999px 2px;transform:rotate(-45deg);background:${bg};box-shadow:0 0 0 3px ${ring},0 4px 12px rgba(0,0,0,.5)`;
  el.innerHTML = `<span style="transform:rotate(45deg);color:#fff;font:700 12px ui-sans-serif,system-ui">${glyph}</span>`;
  return el;
}

export function OfflineVectorMap({ routes, selectedRouteId, className }: OfflineVectorMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // One-time map init.
  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    ensurePmtiles();
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
        center: [0, 20],
        zoom: 1.4,
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

  function draw(): void {
    const map = mapRef.current;
    if (!map) return;
    const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!selected || selected.geometry.length < 2) return;

    const coords = selected.geometry.map((p) => [p.lng, p.lat] as [number, number]);
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
