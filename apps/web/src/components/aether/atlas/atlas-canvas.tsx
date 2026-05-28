'use client';

/**
 * <AtlasCanvas> — the real map surface for Aether.
 *
 * Leaflet-driven map of India with the 10 destinations pinned at
 * real lat/lng. Dark CartoDB tiles give the map a Warm-Italian-meets-
 * night-sky base (espresso paper + ochre roads). Each marker is a
 * custom divIcon — terracotta-glow dot, cream centre, breathing pulse
 * — that on click navigates to /aether/destinations/[slug] and on
 * hover surfaces a tagline tooltip styled like the editorial cards.
 *
 * Surrounding chrome stays editorial: serif headline + italic dek
 * above, numbered destination list below. The constellation sketch
 * we shipped in AE10 has been replaced — this is the real Atlas.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useViewport } from '../use-viewport';

interface Pin {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
  /** Real lat/lng — used by Leaflet + makes the map navigate-able. */
  readonly lat: number;
  readonly lng: number;
}

/** Ten destinations with real coordinates. North → South ordering for
 *  the list below the map; the map auto-fits all markers. */
const PINS: readonly Pin[] = [
  {
    slug: 'leh',
    name: 'Leh',
    state: 'Ladakh',
    tagline: 'High monasteries, thin air.',
    lat: 34.1526,
    lng: 77.5771,
  },
  {
    slug: 'spiti',
    name: 'Spiti',
    state: 'Himachal Pradesh',
    tagline: 'Trans-Himalayan high desert.',
    lat: 32.2455,
    lng: 78.0341,
  },
  {
    slug: 'darjeeling',
    name: 'Darjeeling',
    state: 'West Bengal',
    tagline: 'Tea & Kanchenjunga.',
    lat: 27.041,
    lng: 88.2663,
  },
  {
    slug: 'shillong',
    name: 'Shillong',
    state: 'Meghalaya',
    tagline: 'Scotland of the East.',
    lat: 25.5788,
    lng: 91.8933,
  },
  {
    slug: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    tagline: 'Pink city of forts.',
    lat: 26.9124,
    lng: 75.7873,
  },
  {
    slug: 'udaipur',
    name: 'Udaipur',
    state: 'Rajasthan',
    tagline: 'The City of Lakes.',
    lat: 24.5854,
    lng: 73.7125,
  },
  {
    slug: 'bhuj',
    name: 'Bhuj',
    state: 'Gujarat',
    tagline: 'The white Rann of Kutch.',
    lat: 23.2419,
    lng: 69.6669,
  },
  {
    slug: 'varanasi',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    tagline: 'The oldest living city.',
    lat: 25.3176,
    lng: 82.9739,
  },
  {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    tagline: 'A city of seven islands.',
    lat: 19.076,
    lng: 72.8777,
  },
  {
    slug: 'anjuna',
    name: 'Anjuna',
    state: 'Goa',
    tagline: 'Susegad — beach & cafés.',
    lat: 15.5736,
    lng: 73.74,
  },
  {
    slug: 'hampi',
    name: 'Hampi',
    state: 'Karnataka',
    tagline: 'A vanished empire in granite.',
    lat: 15.335,
    lng: 76.46,
  },
  {
    slug: 'coorg',
    name: 'Coorg',
    state: 'Karnataka',
    tagline: 'Coffee country in the mist.',
    lat: 12.3375,
    lng: 75.8069,
  },
  {
    slug: 'pondicherry',
    name: 'Pondicherry',
    state: 'Tamil Nadu',
    tagline: 'A French quarter on the bay.',
    lat: 11.9416,
    lng: 79.8083,
  },
  {
    slug: 'madurai',
    name: 'Madurai',
    state: 'Tamil Nadu',
    tagline: 'The Athens of the East.',
    lat: 9.9252,
    lng: 78.1198,
  },
  {
    slug: 'alleppey',
    name: 'Alleppey',
    state: 'Kerala',
    tagline: 'Backwaters & houseboats.',
    lat: 9.4981,
    lng: 76.3388,
  },
];

/** CartoDB Dark Matter (no labels) — free, no key, espresso-feeling. */
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const DARK_ATTR =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';
/** CartoDB Dark Matter labels only — overlays warm-tinted place names. */
const DARK_LABELS = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';

export function AtlasCanvas(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<unknown>(null);

  // Boot the Leaflet map once on mount. Dynamic import keeps Leaflet
  // out of any SSR path (already protected by AtlasLazy's ssr:false,
  // but this is belt-and-suspenders).
  useEffect(() => {
    const node = mapDivRef.current;
    if (node === null) return;
    let cleanup = (): void => {};

    void (async (): Promise<void> => {
      const L = (await import('leaflet')).default;
      // Leaflet's CSS — required for the map to render correctly.
      // @ts-expect-error — CSS import has no type declarations.
      await import('leaflet/dist/leaflet.css');

      const map = L.map(node, {
        attributionControl: true,
        zoomControl: true,
        scrollWheelZoom: false, // editorial vibe — no aggressive zoom
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: true,
        // Fit India roughly. fitBounds below overrides this.
        center: [22, 79],
        zoom: 5,
        minZoom: 4,
        maxZoom: 8,
      });

      L.tileLayer(DARK_TILES, {
        attribution: DARK_ATTR,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      L.tileLayer(DARK_LABELS, {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '',
      }).addTo(map);

      const markers = PINS.map((p) => {
        // Terracotta-glow divIcon. The pulse ring + inner cream dot
        // give it the Aether look on the otherwise-OSM tiles.
        const icon = L.divIcon({
          className: 'aether-pin',
          html: `
            <span class="aether-pin-ring"></span>
            <span class="aether-pin-dot"></span>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
        marker.bindTooltip(
          `<div class="aether-pin-tooltip">
            <div class="aether-pin-tooltip-name">${p.name}</div>
            <div class="aether-pin-tooltip-state">${p.state}</div>
            <div class="aether-pin-tooltip-tag">${p.tagline}</div>
          </div>`,
          { className: 'aether-pin-tooltip-wrap', direction: 'top', offset: [0, -8] },
        );
        marker.on('click', () => {
          window.location.href = `/aether/destinations/${p.slug}`;
        });
        return marker;
      });

      // Fit the view to the markers + a touch of padding so the
      // outliers (Leh north / Alleppey south) aren't on the edge.
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });

      mapInstanceRef.current = map;
      cleanup = (): void => {
        map.remove();
        mapInstanceRef.current = null;
      };
    })();

    return () => cleanup();
  }, []);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  return (
    <div
      style={{
        background: ink.base,
        color: surface.base,
        minHeight: '100vh',
        fontFamily: theme.font.ui,
      }}
    >
      <DriftNav />

      {/* HEADER */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: isNarrow
              ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.comfy}px`
              : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.loose}px`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: ochre.glow,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            Atlas · the real map
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 84px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: 0,
              color: surface.base,
            }}
          >
            A map drawn by journeys, not by borders.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(18px, 2vw, 23px)',
              fontStyle: 'italic',
              lineHeight: 1.55,
              maxWidth: '54ch',
              margin: `${theme.space.comfy}px auto 0`,
              color: surface.soft,
              opacity: 0.85,
            }}
          >
            Ten places, one country, the routes between them. Click a pin to land on its page; hover
            to read the line.
          </p>
        </div>
      </Reveal>

      {/* THE MAP */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-label="Destination map"
      >
        <Reveal>
          <div
            ref={mapDivRef}
            role="application"
            aria-label="Map of India with destination pins"
            style={{
              width: '100%',
              aspectRatio: '4 / 5',
              maxHeight: 720,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              border: `1px solid rgba(242, 232, 213, 0.08)`,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
              background: ink.deep,
            }}
          />
        </Reveal>

        <Reveal>
          <div
            style={{
              marginTop: theme.space.loose,
              display: 'flex',
              justifyContent: 'space-between',
              gap: theme.space.comfy,
              flexWrap: 'wrap',
              fontFamily: theme.font.mono,
              fontSize: 11,
              color: surface.soft,
              opacity: 0.6,
            }}
          >
            <span>
              <span style={{ color: accent.glow }}>●</span> ten destinations · click to wander
            </span>
            <span>tiles: CartoDB Dark Matter · attribution OSM</span>
          </div>
        </Reveal>
      </section>

      {/* REGIONS LIST */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-labelledby="atlas-list-heading"
      >
        <Reveal>
          <h2
            id="atlas-list-heading"
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(28px, 3vw, 40px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.loose,
              color: surface.base,
            }}
          >
            Pick a thread to follow
          </h2>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PINS.map((p, idx) => (
            <Reveal key={`row-${p.slug}`} delay={idx * 50}>
              <Link
                href={`/aether/destinations/${p.slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr auto',
                  alignItems: 'baseline',
                  gap: theme.space.comfy,
                  padding: `${theme.space.loose}px 0`,
                  borderBottom: `1px solid rgba(242, 232, 213, 0.08)`,
                  textDecoration: 'none',
                  color: surface.base,
                  transition: 'background 240ms',
                }}
                onMouseEnter={(e) => {
                  if (motionPolicy === 'full') {
                    e.currentTarget.style.background = 'rgba(242, 232, 213, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    color: olive.soft,
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(20px, 2vw, 28px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.014em',
                    fontWeight: 600,
                  }}
                >
                  {p.name}
                  <span style={{ color: surface.soft, opacity: 0.5, marginLeft: 8 }}>
                    · {p.state}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: theme.text.body.size,
                    color: surface.soft,
                    opacity: 0.78,
                  }}
                >
                  {p.tagline}
                </span>
                <span
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    fontWeight: 600,
                    color: accent.glow,
                    letterSpacing: '0.02em',
                  }}
                >
                  Explore →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <EditorialFooter />

      {/* Aether pin + tooltip styles — Leaflet uses className strings,
          so the easiest way to style the icons is a global <style> block
          scoped via class prefix. */}
      <style>{`
        .aether-pin {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .aether-pin-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, ${accent.glow} 0%, rgba(194, 97, 74, 0) 70%);
          opacity: 0.85;
          ${motionPolicy === 'full' ? 'animation: aether-pin-pulse 2.6s ease-in-out infinite;' : ''}
        }
        .aether-pin-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          margin-top: -5px;
          border-radius: 50%;
          background: ${accent.base};
          box-shadow: 0 0 0 2px ${surface.base}, 0 0 12px ${accent.glow};
        }
        .aether-pin:hover .aether-pin-dot {
          background: ${accent.glow};
          transform: scale(1.18);
          transition: transform 220ms cubic-bezier(0.42, 0, 0.18, 1);
        }
        @keyframes aether-pin-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.4); opacity: 0.35; }
        }

        .aether-pin-tooltip-wrap {
          background: rgba(242, 232, 213, 0.97) !important;
          color: ${ink.base} !important;
          border: 1px solid ${ink.whisper} !important;
          border-radius: ${theme.radius.md}px !important;
          padding: 8px 12px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
          font-family: ${theme.font.ui};
        }
        .aether-pin-tooltip-wrap.leaflet-tooltip-top:before {
          border-top-color: rgba(242, 232, 213, 0.97) !important;
        }
        .aether-pin-tooltip-name {
          font-family: ${theme.font.display};
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.012em;
          color: ${ink.base};
        }
        .aether-pin-tooltip-state {
          font-family: ${theme.font.ui};
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${accent.deep};
          font-weight: 600;
          margin-top: 2px;
        }
        .aether-pin-tooltip-tag {
          font-family: ${theme.font.display};
          font-style: italic;
          font-size: 13px;
          color: ${ink.soft};
          margin-top: 4px;
          max-width: 220px;
          line-height: 1.4;
        }

        /* Leaflet zoom-control restyle to match Aether palette */
        .leaflet-control-zoom a {
          background: rgba(242, 232, 213, 0.92) !important;
          color: ${ink.base} !important;
          border-color: ${ink.whisper} !important;
          font-family: ${theme.font.ui};
        }
        .leaflet-control-zoom a:hover {
          background: ${accent.base} !important;
          color: ${surface.base} !important;
        }
        .leaflet-control-attribution {
          background: rgba(24, 15, 11, 0.78) !important;
          color: ${surface.soft} !important;
          font-family: ${theme.font.mono};
          font-size: 9px !important;
        }
        .leaflet-control-attribution a {
          color: ${ochre.glow} !important;
        }
      `}</style>
    </div>
  );
}
