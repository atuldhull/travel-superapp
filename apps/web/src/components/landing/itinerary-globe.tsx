/**
 * ItineraryGlobe — the "crazy" view. A real, textured 3D Earth
 * (NASA Blue-Marble continents + oceans, topographic relief, a real
 * starfield) that your trip is drawn onto, then the camera *flies the
 * route*, easing stop → stop while the gold path draws itself.
 *
 * Clear at any zoom + editable:
 *  - stops are **HTML pins**, not 3D point discs — a DOM marker stays
 *    a constant on-screen size however close the camera gets, so it's
 *    a crisp pin, never the giant blob a 3D point becomes up close.
 *    Only the focused stop shows its name (a readable pill — accents
 *    like "São" render fine);
 *  - tap empty globe to drop your own stop (reverse-geocoded to a
 *    real name, $0), tap one of your cyan pins to remove it — the
 *    route re-draws through it. Editing pauses the fly-through.
 *
 * Assets are the Earth textures that ship inside `three-globe`,
 * copied to `/public/globe` so they load same-origin — real imagery,
 * still $0, no CDN, no key. If a texture ever fails the globe falls
 * back to the deep-royal sphere, so it can't break. The whole
 * cinematic is disabled under prefers-reduced-motion.
 *
 * react-globe.gl (three.js) — client + WebGL only, heavy: ALWAYS
 * load via next/dynamic({ ssr:false }) and lazily.
 *
 * Installed for the cinematic-itinerary feature; real-Earth texture,
 * fly-the-route + HTML-pin editing added on user request.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import { extractPlaces } from '../../lib/extract-places';
import { geocodeOne, reverseGeocode } from '../../lib/geocode';
import { cn } from '../../lib/cn';

const GOLD = '#cdab63';
const GOLD_HOT = '#f0d99a';
const CYAN = '#7fd1e8';
const MAX_KM_FROM_CITY = 150;
const DEDUPE_KM = 0.04; // ~40 m — only merge genuine duplicates
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
  readonly custom?: boolean;
}
interface Arc {
  readonly startLat: number;
  readonly startLng: number;
  readonly endLat: number;
  readonly endLng: number;
}
interface PinDatum extends Stop {
  readonly _focused: boolean;
  readonly _idx: number;
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

// Fix mojibake / glyph fallout — normalise + drop replacement chars.
function cleanName(s: string): string {
  return s.normalize('NFC').replace(/�/g, '').replace(/\s+/g, ' ').trim();
}

export function ItineraryGlobe({ plan, city, center, className }: ItineraryGlobeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest remove fn so a pin's DOM click handler is never stale.
  const removeRef = useRef<(p: Stop) => void>(() => {});
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 600, h: 320 });
  const [stops, setStops] = useState<readonly Stop[]>([]);
  const [custom, setCustom] = useState<readonly Stop[]>([]);
  const [status, setStatus] = useState<'charting' | 'done'>('charting');
  const [texOk, setTexOk] = useState<boolean | null>(null);
  const [reveal, setReveal] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const [editing, setEditing] = useState(false);

  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const measure = () => setDims({ w: el.clientWidth || 600, h: el.clientHeight || 320 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geocode the journey progressively (same pipeline as the map view).
  useEffect(() => {
    let alive = true;
    const start: Stop = { name: city, lat: center.lat, lng: center.lng, start: true };
    setStops([start]);
    setCustom([]);
    setStatus('charting');
    setEditing(false);
    setReveal(1);
    setFocusIdx(0);
    void (async () => {
      const candidates = extractPlaces(plan, city);
      const acc: Stop[] = [start];
      for (const c of candidates) {
        if (!alive) return;
        const g = await geocodeOne(c.name, city, center);
        if (!alive) return;
        if (g && haversineKm({ lat: g.lat, lng: g.lng }, center) <= MAX_KM_FROM_CITY) {
          acc.push({ name: cleanName(c.name), lat: g.lat, lng: g.lng });
          setStops(acc.slice());
        }
        await new Promise((r) => setTimeout(r, 220));
      }
      if (alive) setStatus('done');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on center.lat/lng primitives; the center object is intentionally excluded so the build effect doesn't re-run on identity change
  }, [plan, city, center.lat, center.lng]);

  const pts: readonly Stop[] = useMemo(() => {
    const out: Stop[] = [];
    for (const s of [...stops, ...custom]) {
      if (out.some((o) => haversineKm(o, s) <= DEDUPE_KM)) continue;
      out.push(s);
    }
    return out;
  }, [stops, custom]);

  const arcs: readonly Arc[] = useMemo(() => {
    const out: Arc[] = [];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      out.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
    }
    return out;
  }, [pts]);

  const geo = useMemo(() => {
    if (pts.length === 0) return { lat: center.lat, lng: center.lng, spread: 0 };
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const spread = pts.reduce((mx, p) => Math.max(mx, haversineKm({ lat, lng }, p)), 0);
    return { lat, lng, spread };
  }, [pts, center.lat, center.lng]);

  // HTML pins keep a constant screen size, so we can sit close
  // without a blob. Still bounded so the soft texture isn't pointless.
  const legAltitude = Math.min(1.8, Math.max(0.32, 0.3 + geo.spread / 500));
  const overviewAltitude = Math.min(2.6, Math.max(1.1, 0.55 + geo.spread / 250));

  const easeTo = useCallback(
    (lat: number, lng: number, alt: number, ms: number) => {
      globeRef.current?.pointOfView({ lat, lng, altitude: alt }, reduce ? 0 : ms);
    },
    [reduce],
  );

  // While charting: keep the newest stop framed.
  useEffect(() => {
    if (status !== 'charting' || editing || pts.length === 0) return;
    const i = pts.length - 1;
    setFocusIdx(i);
    setReveal(pts.length);
    const p = pts[i]!;
    easeTo(p.lat, p.lng, legAltitude, 900);
  }, [pts, status, editing, legAltitude, easeTo]);

  // Once charted: fly the route stop → stop, then pull back + spin.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || status !== 'done' || editing || pts.length === 0) return;
    const controls = g.controls() as { autoRotate: boolean; autoRotateSpeed: number };

    if (reduce || pts.length < 2) {
      setReveal(pts.length);
      setFocusIdx(pts.length - 1);
      easeTo(geo.lat, geo.lng, overviewAltitude, 1200);
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
      setFocusIdx(i);
      setReveal(i + 1);
      gg.pointOfView({ lat: p.lat, lng: p.lng, altitude: legAltitude }, 1500);
      i += 1;
      tourTimer.current = setTimeout(step, 1850);
    };
    step();
    return () => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
    };
  }, [status, pts, editing, reduce, geo.lat, geo.lng, legAltitude, overviewAltitude, easeTo]);

  const onGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
      const g = globeRef.current;
      if (g) (g.controls() as { autoRotate: boolean }).autoRotate = false;
      setEditing(true);
      const pin: Stop = { name: 'Locating…', lat, lng, custom: true };
      setCustom((prev) => [...prev, pin]);
      easeTo(lat, lng, Math.max(0.3, Math.min(legAltitude, 0.6)), 1100);
      void reverseGeocode(lat, lng).then((name) => {
        setCustom((prev) =>
          prev.map((p) => (p === pin ? { ...p, name: name ? cleanName(name) : 'Custom stop' } : p)),
        );
      });
    },
    [easeTo, legAltitude],
  );

  const removeCustom = useCallback((target: Stop) => {
    if (tourTimer.current) clearTimeout(tourTimer.current);
    setEditing(true);
    setCustom((prev) =>
      prev.filter((c) => !(c.lat === target.lat && c.lng === target.lng && c.name === target.name)),
    );
  }, []);
  removeRef.current = removeCustom;

  useEffect(() => {
    if (!editing) return;
    setReveal(pts.length);
    const g = globeRef.current;
    if (g) (g.controls() as { autoRotate: boolean }).autoRotate = false;
  }, [editing, pts.length]);

  const shownCount = editing || reduce ? pts.length : reveal;
  const shownPts = pts.slice(0, Math.max(1, shownCount));
  const shownArcs = arcs.slice(0, Math.max(0, shownCount - 1));
  const fIdx = Math.min(focusIdx, shownPts.length - 1);

  // New objects each change so react-globe.gl rebuilds the pins
  // (cheap — ≤ ~8) and the focused styling/handlers stay fresh.
  const pinData: PinDatum[] = useMemo(
    () => shownPts.map((p, i) => ({ ...p, _focused: i === fIdx, _idx: i })),
    [shownPts, fIdx],
  );

  const makePin = useCallback(
    (d: object): HTMLElement => {
      const s = d as PinDatum;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'transform:translate(-50%,-50%);will-change:transform';

      const dot = document.createElement('div');
      const color = s.custom ? CYAN : s.start ? GOLD_HOT : GOLD;
      const size = s._focused ? 14 : 9;
      dot.style.cssText =
        `width:${size}px;height:${size}px;border-radius:9999px;background:${color};` +
        `border:2px solid rgba(8,10,26,.85);box-shadow:0 0 0 2px ${color}55,0 2px 6px rgba(0,0,0,.6);` +
        `margin:0 auto;${s.custom ? 'cursor:pointer;pointer-events:auto' : 'pointer-events:none'}`;
      if (s._focused && !reduce && typeof dot.animate === 'function') {
        dot.animate(
          [
            { boxShadow: `0 0 0 2px ${color}55,0 0 0 0 ${color}66` },
            { boxShadow: `0 0 0 2px ${color}55,0 0 0 14px ${color}00` },
          ],
          { duration: 1600, iterations: Infinity, easing: 'ease-out' },
        );
      }
      if (s.custom) {
        dot.title = 'Tap to remove this stop';
        dot.onclick = (e) => {
          e.stopPropagation();
          removeRef.current({ name: s.name, lat: s.lat, lng: s.lng, custom: true });
        };
      }
      wrap.appendChild(dot);

      if (s._focused) {
        const pill = document.createElement('div');
        pill.textContent = s.name;
        pill.style.cssText =
          'margin-top:5px;white-space:nowrap;pointer-events:none;padding:3px 9px;' +
          'border-radius:9999px;font:600 12px ui-sans-serif,system-ui;color:#f6ecd2;' +
          `background:rgba(8,10,26,.74);border:1px solid ${
            s.custom ? 'rgba(127,209,232,.6)' : 'rgba(205,171,99,.55)'
          };box-shadow:0 4px 14px rgba(0,0,0,.5);backdrop-filter:blur(4px)`;
        wrap.appendChild(pill);
      }
      return wrap;
    },
    [reduce],
  );

  const customCount = pts.filter((p) => p.custom).length;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-600/25 shadow-(--shadow-depth-3)',
        className,
      )}
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/20 blur-[90px]"
      />
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={texOk === true ? TEX.globe : undefined}
        bumpImageUrl={texOk === true ? TEX.bump : undefined}
        backgroundImageUrl={texOk === true ? TEX.sky : undefined}
        globeMaterial={texOk === true ? undefined : royalMaterial}
        atmosphereColor={GOLD}
        atmosphereAltitude={0.22}
        onGlobeClick={onGlobeClick}
        arcsData={shownArcs as object[]}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => [GOLD_HOT, GOLD]}
        arcAltitudeAutoScale={0.4}
        arcStroke={0.6}
        arcDashLength={0.4}
        arcDashGap={0.16}
        arcDashInitialGap={1}
        arcDashAnimateTime={reduce ? 0 : 1600}
        arcsTransitionDuration={500}
        htmlElementsData={pinData as object[]}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.012}
        htmlElement={makePin}
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
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 3.6 }, 0);
          g.pointOfView({ lat: center.lat, lng: center.lng, altitude: 2.2 }, reduce ? 0 : 1700);
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-gold-500/40 bg-black/45 px-3 py-1 text-xs font-medium text-gold-200 backdrop-blur-sm">
        {status === 'charting'
          ? `✨ Charting your ${city} journey…`
          : editing
            ? `Editing · ${Math.max(0, pts.length - 1)} stops${customCount ? ` · ${customCount} yours` : ''}`
            : `Flying your route · ${Math.max(0, pts.length - 1)} stop${pts.length - 1 === 1 ? '' : 's'}`}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-gold-500/30 bg-black/45 px-3 py-1 text-[11px] font-medium text-gold-100 backdrop-blur-sm">
        Tap the globe to add a stop · tap a cyan pin to remove
      </div>
    </div>
  );
}
