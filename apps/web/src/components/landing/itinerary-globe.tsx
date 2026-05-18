/**
 * ItineraryGlobe — the "crazy" view. A real, textured 3D Earth
 * (NASA Blue-Marble continents + oceans, topographic relief, a real
 * starfield) that your trip is drawn onto: each geocoded stop a
 * pulsing gold beacon, gold flight-arcs between them — then the
 * camera *flies the route*, easing from stop to stop in order while
 * the path draws itself segment by segment.
 *
 * Assets are the Earth textures that ship inside `three-globe`,
 * copied to `/public/globe` so they load **same-origin** — real
 * imagery, still $0, no CDN, no key. If a texture ever fails the
 * globe falls back to the deep-royal sphere, so it can't break.
 *
 * Same pipeline as the map view (extract landmarks from the AI prose
 * → city-biased $0 OSM geocode), revealed progressively. The whole
 * cinematic (spin, dash, ring pulse, fly-through) is disabled under
 * prefers-reduced-motion — it just frames the journey instead.
 *
 * react-globe.gl (three.js) — client + WebGL only, heavy: ALWAYS
 * load via next/dynamic({ ssr:false }) and lazily.
 *
 * Installed for the cinematic-itinerary feature; real-Earth texture
 * + fly-the-route animation added on user request.
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
const DEDUPE_KM = 0.3; // merge only near-identical geocodes
const TEX = {
  globe: '/globe/earth-blue-marble.jpg',
  bump: '/globe/earth-topology.png',
  sky: '/globe/night-sky.png',
} as const;

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
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 600, h: 320 });
  const [stops, setStops] = useState<readonly Stop[]>([]);
  const [status, setStatus] = useState<'charting' | 'done'>('charting');
  // null = still checking the texture; true = real Earth; false = the
  // royal-sphere fallback (so the globe can never fail to render).
  const [texOk, setTexOk] = useState<boolean | null>(null);
  // How many stops are currently lit. During charting that's "all so
  // far"; during the fly-through it steps 1..n to draw the route.
  const [reveal, setReveal] = useState(0);

  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deep-royal fallback material — zero external assets.
  const royalMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: '#1b2150',
        emissive: '#10184a',
        emissiveIntensity: 0.9,
        shininess: 22,
      }),
    [],
  );

  // Preflight the Earth texture so a swap never flashes black.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setTexOk(true);
    img.onerror = () => alive && setTexOk(false);
    img.src = TEX.globe;
    return () => {
      alive = false;
    };
  }, []);

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
    setReveal(1);
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
        await new Promise((r) => setTimeout(r, 220));
      }
      if (alive) setStatus('done');
    })();
    return () => {
      alive = false;
    };
  }, [plan, city, center.lat, center.lng]);

  // Distinct stops — merge only near-identical geocodes so the route
  // keeps its real shape (the old 25 km clustering collapsed a whole
  // day-plan into one dot; with a real texture we can zoom in).
  const pts: readonly Stop[] = useMemo(() => {
    const out: Stop[] = [];
    for (const s of stops) {
      if (out.some((o) => haversineKm(o, s) <= DEDUPE_KM)) continue;
      out.push(s);
    }
    return out;
  }, [stops]);

  const arcs: readonly Arc[] = useMemo(() => {
    const out: Arc[] = [];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      out.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
    }
    return out;
  }, [pts]);

  // Spread of the journey → how close the camera can sensibly get.
  const geo = useMemo(() => {
    if (pts.length === 0) return { lat: center.lat, lng: center.lng, spread: 0 };
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const spread = pts.reduce((mx, p) => Math.max(mx, haversineKm({ lat, lng }, p)), 0);
    return { lat, lng, spread };
  }, [pts, center.lat, center.lng]);

  const legAltitude = Math.min(1.8, Math.max(0.18, 0.18 + geo.spread / 500));
  const overviewAltitude = Math.min(2.6, Math.max(1.2, 0.6 + geo.spread / 250));

  // While charting: keep the latest stop framed so each new place
  // visibly "drops in" as the camera glides to it.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || status !== 'charting' || pts.length === 0) return;
    const last = pts[pts.length - 1]!;
    g.pointOfView({ lat: last.lat, lng: last.lng, altitude: legAltitude }, reduce ? 0 : 900);
    setReveal(pts.length);
  }, [pts, status, legAltitude, reduce]);

  // Once charted: fly the route — ease stop → stop in order while the
  // arcs draw themselves, then pull back to an overview and spin.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || status !== 'done' || pts.length === 0) return;
    const controls = g.controls() as { autoRotate: boolean; autoRotateSpeed: number };

    if (reduce || pts.length < 2) {
      setReveal(pts.length);
      g.pointOfView({ lat: geo.lat, lng: geo.lng, altitude: overviewAltitude }, reduce ? 0 : 1200);
      return;
    }

    controls.autoRotate = false;
    let i = 0;
    setReveal(1);
    const step = () => {
      const gg = globeRef.current;
      if (!gg) return;
      if (i >= pts.length) {
        gg.pointOfView({ lat: geo.lat, lng: geo.lng, altitude: overviewAltitude }, 1700);
        const c = gg.controls() as { autoRotate: boolean; autoRotateSpeed: number };
        c.autoRotate = true;
        c.autoRotateSpeed = 0.55;
        return;
      }
      const p = pts[i]!;
      gg.pointOfView({ lat: p.lat, lng: p.lng, altitude: legAltitude }, 1500);
      setReveal(i + 1);
      i += 1;
      tourTimer.current = setTimeout(step, 1850);
    };
    step();
    return () => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
    };
  }, [status, pts, reduce, geo.lat, geo.lng, legAltitude, overviewAltitude]);

  const shownPts = pts.slice(0, Math.max(1, reveal));
  const shownArcs = arcs.slice(0, Math.max(0, reveal - 1));
  // null (still checking) is treated as "not ready" → safe royal
  // sphere until the real Earth texture is confirmed loaded.
  const useTex = texOk === true;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-600/25 shadow-(--shadow-depth-3)',
        className,
      )}
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
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
        globeImageUrl={useTex ? TEX.globe : undefined}
        bumpImageUrl={useTex ? TEX.bump : undefined}
        backgroundImageUrl={useTex ? TEX.sky : undefined}
        globeMaterial={useTex ? undefined : royalMaterial}
        atmosphereColor={GOLD}
        atmosphereAltitude={0.22}
        arcsData={shownArcs as object[]}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => [GOLD_HOT, GOLD]}
        arcAltitudeAutoScale={0.5}
        arcStroke={1.1}
        arcDashLength={0.4}
        arcDashGap={0.16}
        arcDashInitialGap={1}
        arcDashAnimateTime={reduce ? 0 : 1600}
        arcsTransitionDuration={500}
        pointsData={shownPts as object[]}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => ((d as Stop).start ? GOLD_HOT : GOLD)}
        pointAltitude={0.02}
        pointRadius={0.55}
        pointsTransitionDuration={400}
        ringsData={shownPts as object[]}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(240,217,154,${Math.max(0, 1 - t)})`}
        ringMaxRadius={5}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={reduce ? 0 : 1100}
        labelsData={shownPts as object[]}
        labelLat="lat"
        labelLng="lng"
        labelText={(d) => (d as Stop).name}
        labelSize={1.2}
        labelDotRadius={0.45}
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
          controls.autoRotateSpeed = 0.55;
          controls.enableZoom = true;
          // Cinematic approach: from far in space down to the city.
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 3.6 }, 0);
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 2.2 }, reduce ? 0 : 1700);
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-gold-500/40 bg-black/45 px-3 py-1 text-xs font-medium text-gold-200 backdrop-blur-sm">
        {status === 'charting'
          ? `✨ Charting your ${city} journey…`
          : pts.length > 1
            ? `Flying your route · ${pts.length - 1} stops · drag to explore`
            : `${city} — your trip, on Earth · see Story/Map for each stop`}
      </div>
    </div>
  );
}
