/**
 * ItineraryStoryboard — the default, image-led view. A globe can't
 * separate places 1 km apart in one city; this can. Each stop the AI
 * named becomes a premium card with a real destination PHOTO (free
 * Wikipedia imagery), its order, and name — so every place is
 * visually distinct. Below: "Where to stay" — the best-rated hotels
 * in the area from OpenStreetMap ($0), each with a booking link.
 *
 * Same extract → $0 OSM-geocode pipeline as the map/globe, revealed
 * progressively. Never broken: no photo → royal gradient; no hotels
 * → the section just hides. Reduced-motion safe.
 *
 * Installed for the image+hotels itinerary feature.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BedDouble, Clock, ExternalLink, MapPin, Signal, Sparkles, Star } from 'lucide-react';
import { extractPlaces } from '../../lib/extract-places';
import { geocodeOne } from '../../lib/geocode';
import { insightFor, CROWD_UI } from '../../lib/itinerary-insights';
import { nearbyHotels, type NearbyHotel } from '../../lib/nearby-hotels';
import { DestinationImage } from '../ui/destination-image';
import { cn } from '../../lib/cn';

const MAX_KM = 150;

interface Stop {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly start?: boolean;
}

export interface ItineraryStoryboardProps {
  readonly plan: string;
  readonly city: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly className?: string;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function ItineraryStoryboard({ plan, city, center, className }: ItineraryStoryboardProps) {
  const reduce = useReducedMotion();
  const [stops, setStops] = useState<readonly Stop[]>([]);
  const [charting, setCharting] = useState(true);
  const [hotels, setHotels] = useState<readonly NearbyHotel[] | null>(null);

  useEffect(() => {
    let alive = true;
    const start: Stop = { name: city, lat: center.lat, lng: center.lng, start: true };
    setStops([start]);
    setCharting(true);
    setHotels(null);

    void (async () => {
      const acc: Stop[] = [start];
      for (const c of extractPlaces(plan, city)) {
        if (!alive) return;
        const g = await geocodeOne(c.name, city, center);
        if (!alive) return;
        if (g && km({ lat: g.lat, lng: g.lng }, center) <= MAX_KM) {
          acc.push({ name: c.name, lat: g.lat, lng: g.lng });
          setStops(acc.slice());
        }
        await new Promise((r) => setTimeout(r, 220));
      }
      if (alive) setCharting(false);
    })();

    // Hotels: one Overpass call around the city centre (independent
    // of the per-stop geocoding so it lands fast).
    void nearbyHotels(center.lat, center.lng, city, { radiusM: 5000, limit: 6 }).then((h) => {
      if (alive) setHotels(h);
    });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on center.lat/lng primitives; the center object is intentionally excluded so the build effect doesn't re-run on identity change
  }, [plan, city, center.lat, center.lng]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stop cards — every place gets its own photo, so they're
          unmistakably distinct even when geographically close. */}
      <div>
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gold-700 dark:text-gold-300">
          <Sparkles aria-hidden className="h-3.5 w-3.5" />
          {charting
            ? `Charting your ${city} journey…`
            : `${city} itinerary · ${stops.length - 1} stops`}
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stops.map((s, i) => (
            <motion.li
              key={`${s.name}-${i}`}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}
              className="group overflow-hidden rounded-2xl border border-gold-600/15 bg-surface shadow-(--shadow-depth-1) transition hover:-translate-y-1 hover:border-gold-600/30 hover:shadow-(--shadow-depth-3)"
            >
              <div className="relative">
                <DestinationImage
                  place={s.name}
                  alt={s.name}
                  scrim
                  rounded="rounded-none"
                  className="aspect-video w-full transition duration-500 group-hover:scale-105"
                />
                <span
                  className={cn(
                    'absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold shadow-(--shadow-depth-1)',
                    s.start ? 'text-brand-900' : 'bg-brand-900/80 text-gold-200 backdrop-blur-sm',
                  )}
                  style={s.start ? { backgroundImage: 'var(--gradient-gold)' } : undefined}
                >
                  {s.start ? '★' : i}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-display text-sm font-semibold leading-snug tracking-tight text-white">
                    {s.name}
                  </p>
                  {s.start ? (
                    <p className="text-[11px] text-white/70">Trip base</p>
                  ) : (
                    (() => {
                      const ins = insightFor(s.name, plan, i - 1);
                      const c = CROWD_UI[ins.crowd];
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80">
                          <span className="inline-flex items-center gap-1">
                            <Clock aria-hidden className="h-3 w-3 text-gold-300" />
                            {ins.time}
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            title={`${ins.tip}${ins.fromPlan ? '' : ' (estimate)'}`}
                          >
                            <Signal aria-hidden className={cn('h-3 w-3', c.cls)} />
                            <span className="inline-flex items-end gap-0.5">
                              {[0, 1, 2].map((b) => (
                                <span
                                  key={b}
                                  className={cn(
                                    'w-0.5 rounded-sm',
                                    b === 0 ? 'h-1.5' : b === 1 ? 'h-2' : 'h-2.5',
                                    b < c.bars ? c.cls : 'text-white/25',
                                  )}
                                  style={{ backgroundColor: 'currentColor' }}
                                />
                              ))}
                            </span>
                            {c.label}
                            {!ins.fromPlan && <span className="text-white/40">·est</span>}
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Where to stay — best-rated OSM hotels, booking links. */}
      {hotels === null ? (
        <div className="h-28 animate-pulse rounded-2xl border border-gold-600/15 bg-gold-500/5" />
      ) : hotels.length > 0 ? (
        <div className="rounded-2xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1)">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-surface-foreground">
              <BedDouble aria-hidden className="h-4 w-4 text-gold-600" />
              Where to stay in {city}
            </h3>
            <span className="text-[11px] text-muted">Top-rated nearby · OpenStreetMap</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {hotels.map((h) => (
              <li
                key={h.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-gold-600/12 bg-gold-500/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-surface-foreground">{h.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    {h.stars ? (
                      <>
                        {Array.from({ length: h.stars }).map((_, k) => (
                          <Star
                            key={k}
                            aria-hidden
                            className="h-3 w-3 fill-gold-500 text-gold-500"
                          />
                        ))}
                        <span className="ml-1">{h.stars}-star</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden className="h-3 w-3" /> Near the action
                      </span>
                    )}
                  </p>
                </div>
                <a
                  href={h.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-900 shadow-(--shadow-depth-1) transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ backgroundImage: 'var(--gradient-gold)' }}
                >
                  Find rooms
                  <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Hotels from OpenStreetMap, ranked by rating. “Find rooms” opens a booking search (or the
            hotel’s own site) — no live prices here.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-gold-600/15 bg-surface px-5 py-4 text-sm text-muted shadow-(--shadow-depth-1)">
          Couldn’t pull stays for {city} right now — the map &amp; globe views still show the route.
        </p>
      )}
    </div>
  );
}
