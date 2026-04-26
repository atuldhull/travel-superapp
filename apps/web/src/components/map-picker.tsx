/**
 * Click-to-pick map component using vanilla Leaflet (no react-leaflet
 * dependency to avoid the React-version compatibility dance). Tiles
 * are OSM — no API key needed in dev. For prod we'd swap in Mapbox
 * or MapTiler under the same component contract.
 *
 * Usage:
 *   <MapPicker
 *     value={{ lng, lat }}
 *     onChange={({ lng, lat }) => ...}
 *     className="h-72 w-full"
 *   />
 *
 * SSR posture: this is a client-only component; the parent must
 * either be `'use client'` or load this via `next/dynamic({ ssr: false })`.
 *
 * Installed by prompt [IV.18.19.38].
 */
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../lib/cn';

// Leaflet's default icon assumes the marker images live next to the
// CSS bundle, which doesn't survive Next's bundler. Inline SVG works
// without asset wrangling.
const PIN_ICON = L.divIcon({
  className: 'travel-map-pin',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32" fill="none">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="#2563eb"/>
    <circle cx="12" cy="12" r="4" fill="#ffffff"/>
  </svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 32],
});

interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

export interface MapPickerProps {
  readonly value: LngLat | null;
  readonly onChange: (next: LngLat) => void;
  readonly className?: string;
  readonly initialZoom?: number;
}

const DEFAULT_CENTER: LngLat = { lng: 77.5946, lat: 12.9716 }; // Bengaluru — neutral starting point

export function MapPicker({ value, onChange, className, initialZoom = 4 }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // One-time map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = value ?? DEFAULT_CENTER;
    const map = L.map(containerRef.current).setView([start.lat, start.lng], initialZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e) => {
      onChange({ lng: e.latlng.lng, lat: e.latlng.lat });
    });
    mapRef.current = map;
    if (value) {
      markerRef.current = L.marker([value.lat, value.lng], { icon: PIN_ICON }).addTo(map);
    }
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Intentionally empty deps — we want a stable map instance for
    // the component's lifetime; subsequent value changes are handled
    // in the second effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to external value changes (e.g. controlled form re-render).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        markerRef.current = L.marker([value.lat, value.lng], { icon: PIN_ICON }).addTo(map);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Click to pick the trip's center coordinates"
      className={cn('overflow-hidden rounded-md border border-muted/30 bg-muted/5', className)}
    />
  );
}
