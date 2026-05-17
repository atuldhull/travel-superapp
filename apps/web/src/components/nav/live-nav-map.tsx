/**
 * LiveNavMap — the premium turn-aware map. Vanilla Leaflet + free OSM
 * tiles (same key-free pattern as RouteMap / MapPicker), upgraded to
 * a "royal" navigation surface:
 *
 *   • the SELECTED route is drawn as traffic-coloured sub-polylines
 *     (free → emerald, moderate → amber, heavy → orange, blocked →
 *     red) with a soft champagne casing underneath;
 *   • the OTHER routes are faint gold dashed alternatives you can
 *     click to switch to;
 *   • a glowing gold pulse travels along the selected route (the
 *     "live preview" head) — frozen when prefers-reduced-motion;
 *   • origin / destination / waypoint pins + red incident pins for
 *     any `blockage` advisory;
 *   • an optional live "you are here" GPS dot via the browser
 *     Geolocation API (watchPosition), cleaned up on unmount.
 *
 * Dumb-imperative: the parent owns data + selection; this component
 * only renders and emits `onSelectRoute`. No SSR (Leaflet touches
 * `window`) — load via next/dynamic({ ssr: false }).
 *
 * Installed for the live-navigation feature.
 */
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NavRoute, TrafficLevel } from '../../lib/two-oh-api';
import { cn } from '../../lib/cn';

const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  free: '#15b371',
  moderate: '#d99a2b',
  heavy: '#e8702a',
  blocked: '#dc2626',
};
const GOLD = '#cdab63';
const FALLBACK_CENTER: [number, number] = [20.5937, 78.9629]; // India — neutral.

function pin(bg: string, glyph: string, ring = 'rgba(205,171,99,.55)'): L.DivIcon {
  return L.divIcon({
    className: 'tsa-nav-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${bg};color:#fff;font:600 13px ui-sans-serif,system-ui;box-shadow:0 0 0 3px ${ring},0 4px 14px rgba(0,0,0,.45);">${glyph}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const GPS_ICON = L.divIcon({
  className: 'tsa-gps-dot',
  html: `<span class="tsa-gps"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export interface LiveNavMapProps {
  readonly routes: readonly NavRoute[];
  readonly selectedRouteId: string;
  readonly recommendedRouteId: string;
  readonly onSelectRoute: (id: string) => void;
  readonly showLiveLocation?: boolean;
  readonly className?: string;
}

export function LiveNavMap({
  routes,
  selectedRouteId,
  recommendedRouteId,
  onSelectRoute,
  showLiveLocation = false,
  className,
}: LiveNavMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const gpsRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;

  // One-time map setup + injected styles for the GPS pulse.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(FALLBACK_CENTER, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const styleId = 'tsa-nav-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .tsa-gps{display:block;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.35);position:relative}
        .tsa-gps::after{content:"";position:absolute;inset:-6px;border-radius:9999px;border:2px solid rgba(37,99,235,.5);animation:tsa-gps-ping 1.8s cubic-bezier(0,0,.2,1) infinite}
        @keyframes tsa-gps-ping{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.8);opacity:0}}
        @media (prefers-reduced-motion: reduce){.tsa-gps::after{animation:none}}
      `;
      document.head.appendChild(style);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      gpsRef.current = null;
    };
  }, []);

  // Redraw routes whenever data / selection changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (routes.length === 0) return;

    const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0]!;

    // 1. Faint dashed alternatives (click to switch).
    for (const r of routes) {
      if (r.id === selected.id) continue;
      const line = L.polyline(
        r.geometry.map((p) => [p.lat, p.lng] as [number, number]),
        { color: GOLD, weight: 3, opacity: 0.3, dashArray: '4 9' },
      ).addTo(layer);
      line.on('click', () => onSelectRef.current(r.id));
      line.on('mouseover', () => line.setStyle({ opacity: 0.6 }));
      line.on('mouseout', () => line.setStyle({ opacity: 0.3 }));
    }

    // 2. Champagne casing under the selected route.
    const sel = selected.geometry.map((p) => [p.lat, p.lng] as [number, number]);
    L.polyline(sel, { color: GOLD, weight: 11, opacity: 0.22, lineCap: 'round' }).addTo(layer);

    // 3. Traffic-coloured segments on top.
    const segs =
      selected.trafficSegments.length > 0
        ? selected.trafficSegments
        : [{ fromIndex: 0, toIndex: sel.length - 1, level: 'free' as TrafficLevel }];
    for (const s of segs) {
      const slice = sel.slice(s.fromIndex, Math.min(sel.length, s.toIndex + 2));
      if (slice.length < 2) continue;
      L.polyline(slice, {
        color: TRAFFIC_COLOR[s.level],
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);
    }

    // 4. Endpoint + waypoint + incident pins.
    const first = sel[0]!;
    const last = sel[sel.length - 1]!;
    L.marker(first, { icon: pin('#1d2850', 'A'), title: 'Start' }).addTo(layer);
    L.marker(last, { icon: pin('#3a2d57', 'B'), title: 'Destination' }).addTo(layer);
    for (const adv of selected.advisories) {
      if (adv.kind === 'blockage' && adv.atLat != null && adv.atLng != null) {
        L.marker([adv.atLat, adv.atLng], {
          icon: pin('#dc2626', '!', 'rgba(220,38,38,.4)'),
          title: adv.message,
        })
          .addTo(layer)
          .bindPopup(`<strong>Closure</strong><br/>${adv.message}`);
      }
    }

    map.fitBounds(L.latLngBounds(sel), { padding: [40, 40], maxZoom: 14 });

    // 5. Travelling gold pulse head (frozen if reduced-motion).
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const head = L.circleMarker(sel[0]!, {
      radius: 6,
      color: '#fff',
      weight: 2,
      fillColor: GOLD,
      fillOpacity: 1,
    }).addTo(layer);
    if (reduce || sel.length < 2) {
      head.setLatLng(sel[Math.floor(sel.length / 2)]!);
    } else {
      const DURATION = 4200;
      let start = 0;
      const step = (ts: number) => {
        if (!start) start = ts;
        const t = ((ts - start) % DURATION) / DURATION;
        const fpos = t * (sel.length - 1);
        const i = Math.floor(fpos);
        const frac = fpos - i;
        const a = sel[i]!;
        const b = sel[Math.min(sel.length - 1, i + 1)]!;
        head.setLatLng([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }
  }, [routes, selectedRouteId, recommendedRouteId]);

  // Live GPS "you are here" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showLiveLocation || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (gpsRef.current) {
          gpsRef.current.setLatLng(ll);
        } else {
          gpsRef.current = L.marker(ll, {
            icon: GPS_ICON,
            title: 'You are here',
            zIndexOffset: 1000,
          }).addTo(map);
        }
      },
      () => {
        /* permission denied / unavailable — silently skip the dot */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      if (gpsRef.current && mapRef.current) {
        mapRef.current.removeLayer(gpsRef.current);
        gpsRef.current = null;
      }
    };
  }, [showLiveLocation]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Live navigation map"
      className={cn(
        'overflow-hidden rounded-2xl border border-gold-600/20 bg-surface shadow-(--shadow-depth-2)',
        className,
      )}
    />
  );
}
