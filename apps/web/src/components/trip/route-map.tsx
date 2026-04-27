/**
 * V.UX.6 RouteMap. Renders a Leaflet map with markers at each
 * routable item + a polyline drawn between consecutive markers in
 * the order received. The parent supplies coords; this component is
 * dumb-render so the polyline updates instantly when the parent's
 * drag-and-drop reorders the items.
 *
 * Vanilla Leaflet (no react-leaflet), same pattern as MapPicker.
 *
 * Installed by prompt [V.UX.6].
 */
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/cn';

const PIN_ICON = (label: string): L.DivIcon =>
  L.divIcon({
    className: 'travel-route-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#2563eb;color:white;font:bold 12px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export interface RouteStop {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly label?: string;
}

export interface RouteMapProps {
  readonly stops: readonly RouteStop[];
  readonly className?: string;
}

const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru — neutral starting point.

export function RouteMap({ stops, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // One-time map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(FALLBACK_CENTER, 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers + polyline whenever stops change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (stops.length === 0) return;
    stops.forEach((s, i) => {
      L.marker([s.lat, s.lng], { icon: PIN_ICON(String(i + 1)), title: s.label }).addTo(layer);
    });
    if (stops.length >= 2) {
      const path = stops.map((s) => [s.lat, s.lng] as [number, number]);
      L.polyline(path, { color: '#2563eb', weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(
        layer,
      );
    }

    // Fit the map to the stops with a little padding so all markers
    // are visible.
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [stops]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Day route preview"
      className={cn('overflow-hidden rounded-md border border-muted/30 bg-muted/5', className)}
    />
  );
}
