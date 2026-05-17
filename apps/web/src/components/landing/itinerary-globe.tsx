/**
 * ItineraryGlobe — the "crazy" view. A real 3D WebGL globe (deep
 * royal sphere, champagne atmosphere, starless space) that spins
 * slowly while glowing gold flight-arcs draw themselves between the
 * itinerary's geocoded stops, each stop a pulsing ring — the sci-fi
 * airline-network look, but it's your actual trip.
 *
 * Same pipeline as the map view (extract landmarks from the AI prose
 * → city-biased $0 OSM geocode), revealed progressively as arcs +
 * rings light up. ZERO external assets (no tiles, no texture, no
 * GeoJSON) — pure three.js, so it can never fail to render. The
 * camera eases to frame the journey; prefers-reduced-motion stops
 * the spin + dash + ring pulse.
 *
 * react-globe.gl (three.js) — client + WebGL only, heavy: ALWAYS
 * load via next/dynamic({ ssr:false }) and lazily (it mounts only
 * once a plan exists).
 *
 * Installed for the cinematic-itinerary feature.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import { extractPlaces } from '../../lib/extract-places';
import { geocodeOne } from '../../lib/geocode';
import { cn } from '../../lib/cn';

const GOLD = '#cdab63';
const GOLD_HOT = '#f0d99a';
const MAX_KM_FROM_CITY = 150;

interface Stop {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly start?: boolean;
}
interface Arc {
  readonly startLat: number;
  readonly startLng: number;
  readonly endLat: number;
  readonly endLng: number;
}

export interface ItineraryGlobeProps {
  readonly plan: string;
  readonly city: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly className?: string;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function ItineraryGlobe({ plan, city, center, className }: ItineraryGlobeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 600, h: 320 });
  const [stops, setStops] = useState<readonly Stop[]>([]);
  const [status, setStatus] = useState<'charting' | 'done'>('charting');

  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A royal, texture-less globe material — zero external assets.
  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: '#1b2150',
        emissive: '#10184a',
        emissiveIntensity: 0.9,
        shininess: 22,
      }),
    [],
  );

  // Size to the container.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const measure = () => setDims({ w: el.clientWidth || 600, h: el.clientHeight || 320 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geocode the journey progressively (same as the map view).
  useEffect(() => {
    let alive = true;
    const start: Stop = { name: city, lat: center.lat, lng: center.lng, start: true };
    setStops([start]);
    setStatus('charting');
    void (async () => {
      const candidates = extractPlaces(plan, city);
      const acc: Stop[] = [start];
      for (const c of candidates) {
        if (!alive) return;
        const g = await geocodeOne(c.name, city, center);
        if (!alive) return;
        if (g && haversineKm({ lat: g.lat, lng: g.lng }, center) <= MAX_KM_FROM_CITY) {
          acc.push({ name: c.name, lat: g.lat, lng: g.lng });
          setStops(acc.slice());
        }
        // Photon is lenient — keep it snappy so the journey fills in.
        await new Promise((r) => setTimeout(r, 220));
      }
      if (alive) setStatus('done');
    })();
    return () => {
      alive = false;
    };
  }, [plan, city, center.lat, center.lng]);

  const arcs: Arc[] = useMemo(() => {
    const out: Arc[] = [];
    for (let i = 1; i < stops.length; i += 1) {
      const a = stops[i - 1]!;
      const b = stops[i]!;
      out.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
    }
    return out;
  }, [stops]);

  // Cinematic camera: ease to the journey centroid, framed by how
  // spread out it is — a one-city plan gets a dramatic CLOSE orbital
  // curve (not a far speck); a regional one pulls back.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || stops.length === 0) return;
    const lat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
    const lng = stops.reduce((s, p) => s + p.lng, 0) / stops.length;
    const spread = stops.reduce(
      (mx, p) => Math.max(mx, haversineKm({ lat, lng }, { lat: p.lat, lng: p.lng })),
      0,
    );
    // ≤8km (one city) → 0.5 ; ~120km → ~1.4 ; clamp.
    const altitude = Math.min(1.8, Math.max(0.5, 0.45 + spread / 90));
    g.pointOfView({ lat, lng, altitude }, reduce ? 0 : 1300);
  }, [stops, reduce]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-600/25 shadow-(--shadow-depth-3)',
        className,
      )}
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
      {/* deep-space starfield (static, cheap) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,.7) 50%, transparent), radial-gradient(1px 1px at 78% 14%, rgba(255,255,255,.55) 50%, transparent), radial-gradient(1.4px 1.4px at 36% 68%, rgba(243,224,166,.7) 50%, transparent), radial-gradient(1px 1px at 64% 82%, rgba(255,255,255,.5) 50%, transparent), radial-gradient(1px 1px at 88% 54%, rgba(255,255,255,.45) 50%, transparent), radial-gradient(1.2px 1.2px at 22% 88%, rgba(243,224,166,.55) 50%, transparent)',
        }}
      />
      {/* champagne aura behind the globe */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/20 blur-[90px]"
      />
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        atmosphereColor={GOLD}
        atmosphereAltitude={0.28}
        showGraticules
        arcsData={arcs as object[]}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => [GOLD_HOT, GOLD]}
        arcAltitudeAutoScale={0.62}
        arcStroke={1.1}
        arcDashLength={0.4}
        arcDashGap={0.16}
        arcDashInitialGap={1}
        arcDashAnimateTime={reduce ? 0 : 1600}
        arcsTransitionDuration={500}
        pointsData={stops as object[]}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => ((d as Stop).start ? GOLD_HOT : GOLD)}
        pointAltitude={0.02}
        pointRadius={(d) => ((d as Stop).start ? 0.7 : 0.5)}
        pointsTransitionDuration={400}
        ringsData={(reduce ? stops.slice(-1) : stops) as object[]}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(240,217,154,${Math.max(0, 1 - t)})`}
        ringMaxRadius={4}
        ringPropagationSpeed={2.4}
        ringRepeatPeriod={reduce ? 0 : 1100}
        labelsData={stops as object[]}
        labelLat="lat"
        labelLng="lng"
        labelText={(d) => (d as Stop).name}
        labelSize={1.15}
        labelDotRadius={0.38}
        labelColor={() => 'rgba(243,224,166,0.95)'}
        labelResolution={2}
        onGlobeReady={() => {
          const g = globeRef.current;
          if (!g) return;
          const controls = g.controls() as {
            autoRotate: boolean;
            autoRotateSpeed: number;
            enableZoom: boolean;
          };
          controls.autoRotate = !reduce;
          controls.autoRotateSpeed = 0.7;
          controls.enableZoom = true;
          // Cinematic approach: start far in space, glide down to the
          // trip city.
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 3.4 }, 0);
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 2.2 }, reduce ? 0 : 1600);
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-gold-500/40 bg-black/45 px-3 py-1 text-xs font-medium text-gold-200 backdrop-blur-sm">
        {status === 'charting'
          ? `✨ Charting your ${city} journey…`
          : stops.length > 1
            ? `${stops.length - 1} stop${stops.length - 1 === 1 ? '' : 's'} · spin & explore`
            : `${city} — your journey begins here`}
      </div>
    </div>
  );
}
