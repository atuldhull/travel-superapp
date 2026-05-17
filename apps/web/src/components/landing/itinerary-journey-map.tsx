/**
 * ItineraryJourneyMap — turns the AI's prose plan into a living map.
 *
 * It mines landmark names out of the plan (lib/extract-places),
 * geocodes them $0 via OSM (city-biased, lib/geocode), then animates
 * the journey: a gold "Start" pin for the city, then each stop pin
 * DROPS in one-by-one with a bounce while a dashed gold path grows to
 * connect them and the map eases to fit. Game-like, but real
 * coordinates.
 *
 * Robust by contract — it never looks broken:
 *   • places resolve progressively (pins appear as "discovered");
 *   • a wrong/global geocode > ~150km from the city is discarded;
 *   • if nothing resolves, it still shows the city Start pin + a
 *     gentle note;
 *   • prefers-reduced-motion → instant, no bounce/pulse.
 *
 * Vanilla Leaflet + free OSM tiles (same key-free pattern as
 * LiveNavMap). Client-only — load via next/dynamic({ ssr:false }).
 *
 * Installed for the animated-itinerary feature.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { extractPlaces } from '../../lib/extract-places';
import { geocodeOne } from '../../lib/geocode';
import { cn } from '../../lib/cn';

const GOLD = '#cdab63';
const GOLD_DK = '#b3873b';
const MAX_KM_FROM_CITY = 150;

export interface JourneyStop {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly start?: boolean;
}

export interface ItineraryJourneyMapProps {
  readonly plan: string;
  readonly city: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly className?: string;
}

function haversineKm(a: JourneyStop, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function pinIcon(label: string, start: boolean, reduce: boolean): L.DivIcon {
  const bg = start ? `linear-gradient(135deg,${GOLD_DK},${GOLD})` : '#1d2850';
  const ring = start ? 'rgba(205,171,99,.55)' : 'rgba(205,171,99,.35)';
  const drop = reduce ? '' : 'animation:tsa-drop .55s cubic-bezier(.2,1.4,.3,1) both;';
  return L.divIcon({
    className: 'tsa-journey-pin',
    html: `<div style="${drop}display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px 9999px 9999px 2px;transform:rotate(-45deg);background:${bg};box-shadow:0 0 0 3px ${ring},0 6px 16px rgba(0,0,0,.45);">
             <span style="transform:rotate(45deg);color:#fff;font:700 12px ui-sans-serif,system-ui;">${label}</span>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

export function ItineraryJourneyMap({ plan, city, center, className }: ItineraryJourneyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [stops, setStops] = useState<readonly JourneyStop[]>([]);
  const [status, setStatus] = useState<'mapping' | 'done'>('mapping');

  // One-time map setup + keyframes.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([center.lat, center.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const id = 'tsa-journey-style';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `
        @keyframes tsa-drop{0%{opacity:0;transform:rotate(-45deg) translateY(-26px) scale(.6)}100%{opacity:1;transform:rotate(-45deg) translateY(0) scale(1)}}
        .tsa-pulse{width:14px;height:14px;border-radius:9999px;background:${GOLD};box-shadow:0 0 0 0 rgba(205,171,99,.6);animation:tsa-jpulse 1.8s ease-out infinite}
        @keyframes tsa-jpulse{70%{box-shadow:0 0 0 16px rgba(205,171,99,0)}100%{box-shadow:0 0 0 0 rgba(205,171,99,0)}}
        @media (prefers-reduced-motion: reduce){.tsa-pulse{animation:none}}
      `;
      document.head.appendChild(s);
    }
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the journey whenever the plan/city changes.
  useEffect(() => {
    let alive = true;
    setStops([]);
    setStatus('mapping');
    const startPin: JourneyStop = { name: city, lat: center.lat, lng: center.lng, start: true };
    setStops([startPin]);

    void (async () => {
      const candidates = extractPlaces(plan, city);
      const collected: JourneyStop[] = [startPin];
      for (const c of candidates) {
        if (!alive) return;
        const g = await geocodeOne(c.name, city);
        if (!alive) return;
        if (g) {
          const stop: JourneyStop = { name: c.name, lat: g.lat, lng: g.lng };
          // Discard a wrong global match far from the city.
          if (haversineKm(stop, center) <= MAX_KM_FROM_CITY) {
            collected.push(stop);
            setStops(collected.slice());
          }
        }
        // Nominatim etiquette (≤1 req/s) + lets pins drop in sequence.
        await new Promise((r) => setTimeout(r, 420));
      }
      if (alive) setStatus('done');
    })();

    return () => {
      alive = false;
    };
  }, [plan, city, center.lat, center.lng]);

  // Redraw markers + the growing journey path on every new stop.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || stops.length === 0) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    layer.clearLayers();

    const path = stops.map((s) => [s.lat, s.lng] as [number, number]);
    if (path.length >= 2) {
      L.polyline(path, {
        color: GOLD,
        weight: 3,
        opacity: 0.85,
        dashArray: '2 9',
        lineCap: 'round',
      }).addTo(layer);
    }
    stops.forEach((s, i) => {
      const label = s.start ? '★' : String(i);
      L.marker([s.lat, s.lng], {
        icon: pinIcon(label, !!s.start, reduce),
        title: s.name,
        zIndexOffset: i,
      })
        .addTo(layer)
        .bindPopup(
          `<strong>${s.start ? 'Start · ' : `Stop ${i} · `}</strong>${escapeHtml(s.name)}`,
        );
    });
    // Pulse the most-recently-discovered stop.
    const last = stops[stops.length - 1]!;
    if (!last.start) {
      L.marker([last.lat, last.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="tsa-pulse"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
        zIndexOffset: -1,
      }).addTo(layer);
    }

    const bounds = L.latLngBounds(path);
    map.flyToBounds(bounds, {
      padding: [44, 44],
      maxZoom: 14,
      duration: reduce ? 0 : 0.7,
    });
  }, [stops]);

  const stopCount = stops.filter((s) => !s.start).length;

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        role="application"
        aria-label={`Animated itinerary map for ${city}`}
        className="h-full w-full overflow-hidden rounded-2xl border border-gold-600/20 bg-surface shadow-(--shadow-depth-2)"
      />
      <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-full border border-gold-500/40 bg-black/55 px-3 py-1 text-xs font-medium text-gold-200 backdrop-blur-sm">
        {status === 'mapping'
          ? `✨ Mapping your ${city} journey…`
          : stopCount > 0
            ? `${stopCount} stop${stopCount === 1 ? '' : 's'} plotted`
            : `Couldn't pin exact spots — here's ${city}`}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
