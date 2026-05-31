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
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useViewport } from '../use-viewport';
import { isInSeason } from '../destinations/seasons';
// AE210 — pure filter combinator (text query AND season-toggle).
import { filterPins } from './filter-pins';
import { destinationAccent } from '../destinations/palette';
import { shouldFocusFilterOnSlash } from './slash-focus';
import { shouldGeolocateOnG } from './geolocate-shortcut';
// AE170 — nearestPin math extracted to a pure helper for testability.
import { nearestPin } from './haversine';
// AE182 — pins moved to ./pins.ts so the data is test-reachable.
import { PINS, type Pin } from './pins';
// AE191 — Esc-in-filter decision extracted for testability.
import { decideFilterEsc } from './esc-behaviour';
// AE324 — shared modulo wrap (was inlined here + in trip-checklist).
import { wrapRowIndex } from './wrap-row-index';
// AE329 — error → {status,message} mapping moved to a pure helper.
import { interpretGeolocationError } from './geo-error';
// AE358/AE359 — URL ↔ Atlas state kit (?q=&season=&focus=).
import { atlasParamsEqual, buildAtlasQuery, parseAtlasParams } from './atlas-permalink';
// AE361 — shared 2-digit ordinal (was 6 inline String(idx+1).padStart calls).
import { ordinalLabel } from '../../../lib/ordinal-digits';

/** CartoDB Dark Matter (no labels) — free, no key, espresso-feeling. */
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const DARK_ATTR =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';
/** CartoDB Dark Matter labels only — overlays warm-tinted place names. */
const DARK_LABELS = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';

// AE170 — haversineKm + nearestPin live in ./haversine.ts now so the
// math is unit-testable without the Leaflet shell.

export function AtlasCanvas(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  // AE359 — permalink seed. usePathname + useRouter let us replace the
  // URL without scrolling or pushing history (so back-button still
  // exits Atlas cleanly). Initial read is sync from useSearchParams.
  const router = useRouter();
  const pathname = usePathname();
  const initialParams = useMemo(
    // useSearchParams is reactive on the server but we only want the
    // value at mount-time — re-binding inside a useMemo on mount-only
    // deps gives us the seed without re-firing on every change.
    () =>
      parseAtlasParams(
        typeof window === 'undefined' ? null : new URLSearchParams(window.location.search),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<unknown>(null);
  // AE69 — slug → marker ref so the filter effect can dim/show pins
  // without recreating the map (preserves zoom + center).
  const markersRef = useRef<Map<string, { setOpacity: (n: number) => void }>>(new Map());
  // AE111 — slug → anchor ref for the destinations list rows.
  // Lets the listbox keyboard handler move focus across rows.
  const rowRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  // AE69 — filter input (case-insensitive substring on name / state /
  // tagline). When empty, every pin is full-opacity.
  // AE359 — seeded from the `?q=` permalink so a copied URL re-opens
  // with the same filter pre-applied.
  const [query, setQuery] = useState<string>(initialParams.q);

  // AE127 — filter input ref so '/' shortcut can focus it.
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  // AE71 — "Where am I" geolocation state. The map's user marker is
  // kept in a ref so subsequent geolocate calls can replace it.
  const userMarkerRef = useRef<{ remove: () => void } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'denied' | 'unavailable' | 'ok'>(
    'idle',
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearest, setNearest] = useState<{ pin: Pin; km: number } | null>(null);
  // AE86 — seasonal toggle. When `seasonOnly` is true, only the
  // destinations currently in season survive the filter.
  // AE359 — seeded from the `?season=1` permalink.
  const [seasonOnly, setSeasonOnly] = useState<boolean>(initialParams.season);
  // AE359 — focused-pin slug from `?focus=`. Stays in sync with the
  // listbox cursor so users can copy the URL while a row is highlighted.
  const [focusSlug, setFocusSlug] = useState<string | null>(initialParams.focus);
  const filtered = useMemo(
    () => filterPins(PINS, { query, seasonOnly, isInSeason }),
    [query, seasonOnly],
  );

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

      markersRef.current.clear();
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
        // AE108 — tooltip now surfaces accent note + season status.
        const accentInfo = destinationAccent(p.slug);
        const seasonRow = isInSeason(p.slug)
          ? `<div class="aether-pin-tooltip-season">◐ in season now</div>`
          : '';
        marker.bindTooltip(
          `<div class="aether-pin-tooltip">
            <div class="aether-pin-tooltip-name">${p.name}</div>
            <div class="aether-pin-tooltip-state">${p.state} · <span style="color:${accentInfo.base}">${accentInfo.note}</span></div>
            <div class="aether-pin-tooltip-tag">${p.tagline}</div>
            ${seasonRow}
          </div>`,
          { className: 'aether-pin-tooltip-wrap', direction: 'top', offset: [0, -8] },
        );
        marker.on('click', () => {
          window.location.href = `/aether/destinations/${p.slug}`;
        });
        markersRef.current.set(p.slug, marker);
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

  // AE127 — `/` focuses the filter input (editor convention).
  // Guard moved to ./slash-focus.ts so the matcher is unit-testable
  // (AE144). The handler itself stays here because focusing the ref
  // is DOM-coupled.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const tgt = e.target as HTMLElement | null;
      if (shouldFocusFilterOnSlash(e.key, tgt)) {
        const node = filterInputRef.current;
        if (node === null) return;
        e.preventDefault();
        node.focus();
        node.select();
        return;
      }
      // AE199 — `g` (when not in a form field) triggers geolocate,
      // mirroring the AE127 `/` shortcut for the other Atlas action.
      if (shouldGeolocateOnG(e.key, tgt)) {
        if (geoStatus === 'locating') return;
        e.preventDefault();
        void locateMe();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [geoStatus]);

  // AE69 — dim non-matching pins when filter has typed text. We don't
  // remove them from the map (changing the marker set on every keystroke
  // costs more than setOpacity does, and keeping them in place lets the
  // user see how the filter narrows in spatial context).
  useEffect(() => {
    const matched = new Set(filtered.map((p) => p.slug));
    const showAll = query.trim() === '';
    for (const [slug, marker] of markersRef.current.entries()) {
      const visible = showAll || matched.has(slug);
      marker.setOpacity(visible ? 1 : 0.18);
    }
  }, [filtered, query]);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  // AE111 — focus the row at index `idx`, also dim/highlight its pin on
  // the map by raising opacity briefly. Bounds-checked against the
  // current `filtered` list so wraparound is harmless.
  const focusRow = useCallback(
    (idx: number): void => {
      // AE324 — shared wrap helper; returns -1 for an empty list.
      const wrapped = wrapRowIndex(idx, filtered.length);
      if (wrapped < 0) return;
      const slug = filtered[wrapped]?.slug;
      if (slug === undefined) return;
      const el = rowRefs.current.get(slug);
      if (el !== undefined) {
        el.focus();
        setFocusedIdx(wrapped);
        // AE359 — mirror focused slug into permalink state so a copied
        // URL spotlight-restores the same pin.
        setFocusSlug(slug);
      }
    },
    [filtered],
  );

  // AE360 — drop `focusSlug` when the filter excludes it, so the URL
  // doesn't keep advertising a focus the user can no longer see. Runs
  // every time `filtered` changes; cheap (linear over 15 pins).
  useEffect(() => {
    if (focusSlug === null) return;
    const stillVisible = filtered.some((p) => p.slug === focusSlug);
    if (!stillVisible) setFocusSlug(null);
  }, [filtered, focusSlug]);

  // AE359 — initial-mount focus restore. If the URL had `?focus=<slug>`
  // and that slug exists in the current `filtered` set, scroll the
  // matching row into view and focus it. Runs once; the ref prevents
  // re-fire on later filter changes.
  const didRestoreFocusRef = useRef<boolean>(false);
  useEffect(() => {
    if (didRestoreFocusRef.current) return;
    if (initialParams.focus === null) return;
    if (filtered.length === 0) return;
    const idx = filtered.findIndex((p) => p.slug === initialParams.focus);
    if (idx < 0) return;
    didRestoreFocusRef.current = true;
    // Defer so the rowRefs are populated.
    window.requestAnimationFrame(() => focusRow(idx));
  }, [filtered, focusRow, initialParams.focus]);

  // AE359 — write the URL when state changes. Debounced 250ms so a fast
  // typist doesn't thrash router.replace; uses { scroll: false } so the
  // visible map doesn't reset. atlasParamsEqual gates redundant writes
  // (initial mount with matching URL → no-op).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = { q: query, season: seasonOnly, focus: focusSlug };
      const current = parseAtlasParams(
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null,
      );
      if (atlasParamsEqual(current, next)) return;
      const suffix = buildAtlasQuery(next);
      router.replace(`${pathname}${suffix}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, seasonOnly, focusSlug, pathname, router]);

  // AE111 — Arrow keys / Home / End on the listbox. Enter is left to
  // the native <Link> behaviour (Enter on a focused anchor follows it).
  const onListKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (filtered.length === 0) return;
      const current = focusedIdx < 0 ? 0 : focusedIdx;
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          focusRow(current + 1);
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          focusRow(current - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusRow(0);
          break;
        case 'End':
          e.preventDefault();
          focusRow(filtered.length - 1);
          break;
        default:
          break;
      }
    },
    [filtered.length, focusedIdx, focusRow],
  );

  /** AE71 — "Where am I?" Geolocates the user, drops an ochre pin at
   *  their position, computes nearest destination via haversine, and
   *  pans the map to fit both. Calls fail gracefully with calm copy. */
  async function locateMe(): Promise<void> {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      setGeoStatus('unavailable');
      setGeoError('Your browser does not expose geolocation.');
      return;
    }
    setGeoStatus('locating');
    setGeoError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 12_000,
        });
      });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // AE170 — nearestPin handles the loop + empty-list null guard.
      const best = nearestPin(here, PINS);
      setNearest(best);
      setGeoStatus('ok');

      // Plant / replace the user marker on the map.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any;
      if (map !== null && map !== undefined) {
        const L = (await import('leaflet')).default;
        if (userMarkerRef.current !== null) userMarkerRef.current.remove();
        const userIcon = L.divIcon({
          className: 'aether-pin-me',
          html: `<span class="aether-pin-me-ring"></span><span class="aether-pin-me-dot"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([here.lat, here.lng], { icon: userIcon, title: 'You' }).addTo(map);
        marker.bindTooltip(
          `<div class="aether-pin-tooltip">
            <div class="aether-pin-tooltip-name">You</div>
            <div class="aether-pin-tooltip-state">~${Math.round(pos.coords.accuracy)}m accuracy</div>
          </div>`,
          { className: 'aether-pin-tooltip-wrap', direction: 'top', offset: [0, -8] },
        );
        userMarkerRef.current = marker as { remove: () => void };
        // Fit user + nearest pin together.
        if (best !== null) {
          const bounds = L.latLngBounds([
            [here.lat, here.lng],
            [best.pin.lat, best.pin.lng],
          ]);
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
        } else {
          map.setView([here.lat, here.lng], 6);
        }
      }
    } catch (err) {
      // AE329 — code 1 → denied; anything else → unavailable.
      const outcome = interpretGeolocationError(err);
      setGeoStatus(outcome.status);
      setGeoError(outcome.message);
    }
  }

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

          {/* AE71 — Where am I + nearest-destination chip */}
          <div
            style={{
              marginTop: theme.space.loose,
              display: 'inline-flex',
              gap: theme.space.tight,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => void locateMe()}
              disabled={geoStatus === 'locating'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                borderRadius: theme.radius.pill,
                background: geoStatus === 'ok' ? accent.base : 'rgba(242, 232, 213, 0.10)',
                border: `1px solid ${
                  geoStatus === 'ok' ? accent.base : 'rgba(242, 232, 213, 0.25)'
                }`,
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                fontWeight: 600,
                cursor: geoStatus === 'locating' ? 'wait' : 'pointer',
                opacity: geoStatus === 'locating' ? 0.7 : 1,
                letterSpacing: '0.02em',
              }}
              aria-label="Show my position on the map"
            >
              <span aria-hidden style={{ color: ochre.glow }}>
                ◎
              </span>
              {geoStatus === 'locating'
                ? 'Reading the sky…'
                : geoStatus === 'ok'
                  ? 'You’re on the map'
                  : 'Where am I?'}
            </button>
            {nearest !== null && (
              <Link
                href={`/aether/destinations/${nearest.pin.slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: 'rgba(242, 232, 213, 0.08)',
                  border: `1px solid rgba(242, 232, 213, 0.22)`,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{ color: ochre.glow }}>Nearest</span>
                <span>· {nearest.pin.name}</span>
                <span style={{ opacity: 0.66, fontFamily: theme.font.mono, fontSize: 11 }}>
                  {Math.round(nearest.km)} km
                </span>
                <span aria-hidden style={{ color: accent.glow }}>
                  →
                </span>
              </Link>
            )}
          </div>
          {geoError !== null && (
            <p
              role="alert"
              style={{
                marginTop: theme.space.tight,
                fontFamily: theme.font.ui,
                fontSize: 11,
                color: '#E89A8A',
                opacity: 0.85,
              }}
            >
              {geoError}
            </p>
          )}
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

      {/* AE137 — sr-only aria-live announcer for the focused row.
          Visually hidden via the AE52 .aether-sr-only utility (mounted
          by <AetherA11yStyles/>); screen readers hear "Leh, Ladakh"
          when arrow keys land on a new row. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="aether-sr-only"
        style={{
          position: 'absolute',
          left: -9999,
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
      >
        {focusedIdx >= 0 && filtered[focusedIdx] !== undefined
          ? `${filtered[focusedIdx]?.name}, ${filtered[focusedIdx]?.state}`
          : ''}
      </div>

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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: theme.space.comfy,
              flexWrap: 'wrap',
              marginBottom: theme.space.loose,
            }}
          >
            <div>
              <h2
                id="atlas-list-heading"
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  fontWeight: 600,
                  margin: 0,
                  color: surface.base,
                }}
              >
                Pick a thread to follow
              </h2>
              {/* AE111 — keyboard hint */}
              <p
                style={{
                  marginTop: 6,
                  fontFamily: theme.font.mono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: surface.soft,
                  opacity: 0.55,
                }}
              >
                ↑↓ arrows · ⏎ to open · / ? for help
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: theme.space.tight,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                ref={filterInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // AE155 + AE191 — decision lives in ./esc-behaviour.ts
                // so the two-branch rule is unit-testable.
                onKeyDown={(e) => {
                  const action = decideFilterEsc(e.key, query !== '');
                  if (action === null) return;
                  e.preventDefault();
                  if (action === 'clear') setQuery('');
                  else focusRow(0);
                }}
                placeholder="Filter — city · state · word — press / to focus, Esc to clear"
                aria-label="Filter destinations (press / to focus, Esc to clear)"
                style={{
                  minWidth: 220,
                  padding: `${theme.space.tight}px ${theme.space.inline}px`,
                  borderRadius: theme.radius.pill,
                  background: 'rgba(242, 232, 213, 0.08)',
                  border: `1px solid rgba(242, 232, 213, 0.18)`,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  outline: 'none',
                }}
              />
              <span
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  color: surface.soft,
                  opacity: 0.62,
                  letterSpacing: '0.14em',
                }}
              >
                {filtered.length} / {PINS.length}
              </span>
              {query.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid rgba(242, 232, 213, 0.25)`,
                    color: surface.soft,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  aria-label="Clear filter"
                >
                  clear
                </button>
              )}
              {/* AE86 — seasonal toggle */}
              <button
                type="button"
                onClick={() => setSeasonOnly((s) => !s)}
                aria-pressed={seasonOnly}
                style={{
                  padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: seasonOnly ? 'rgba(110, 123, 92, 0.78)' : 'transparent',
                  border: `1px solid ${seasonOnly ? 'rgba(110, 123, 92, 0.78)' : 'rgba(242, 232, 213, 0.25)'}`,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                {seasonOnly ? '◉ in season only' : '○ in season only'}
              </button>
            </div>
          </div>
        </Reveal>
        <div
          role="listbox"
          aria-label="Destinations list — use arrow keys, Enter to open"
          tabIndex={focusedIdx >= 0 ? -1 : 0}
          aria-activedescendant={
            focusedIdx >= 0 && filtered[focusedIdx] !== undefined
              ? `atlas-row-${filtered[focusedIdx]?.slug}`
              : undefined
          }
          onKeyDown={onListKey}
          // AE117 — when the listbox itself receives focus (Tab from
          // chrome above), forward focus to row 0 so arrows just work.
          // We only forward when no row is currently focused; once a
          // row owns focus, tabIndex={-1} above hides the container
          // from the tab order so Shift+Tab leaves cleanly.
          onFocus={(e) => {
            if (e.target === e.currentTarget && focusedIdx < 0 && filtered.length > 0) {
              focusRow(0);
            }
          }}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {filtered.length === 0 && (
            <Reveal>
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: surface.soft,
                  opacity: 0.78,
                  margin: 0,
                  padding: `${theme.space.loose}px 0`,
                }}
              >
                No threads match "{query}". Try another word.
              </p>
            </Reveal>
          )}
          {filtered.map((p, idx) => (
            <Reveal key={`row-${p.slug}`} delay={idx * 50}>
              <Link
                id={`atlas-row-${p.slug}`}
                role="option"
                aria-selected={focusedIdx === idx}
                href={`/aether/destinations/${p.slug}`}
                ref={(el) => {
                  if (el === null) {
                    rowRefs.current.delete(p.slug);
                  } else {
                    rowRefs.current.set(p.slug, el);
                  }
                }}
                onFocus={() => setFocusedIdx(idx)}
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
                  {ordinalLabel(idx)}
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
                  {/* AE126 — in-season chip on the list row (mirror AE83
                      destination cards + AE107 journeys index). Olive so
                      it reads as 'now', not as another accent. */}
                  {isInSeason(p.slug) && (
                    <span
                      style={{
                        marginLeft: 10,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontFamily: theme.font.ui,
                        fontStyle: 'normal',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        background: 'rgba(110, 123, 92, 0.22)',
                        color: olive.glow,
                        verticalAlign: 'middle',
                      }}
                    >
                      ◐ in season
                    </span>
                  )}
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

        /* AE71 — user position marker. Ochre instead of terracotta so
           the user pin reads as 'you' rather than 'a destination'. */
        .aether-pin-me {
          position: relative;
          width: 22px;
          height: 22px;
        }
        .aether-pin-me-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, ${ochre.glow} 0%, rgba(194, 138, 74, 0) 70%);
          ${motionPolicy === 'full' ? 'animation: aether-pin-pulse 3.2s ease-in-out infinite;' : ''}
        }
        .aether-pin-me-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          margin-left: -4px;
          margin-top: -4px;
          border-radius: 50%;
          background: ${surface.base};
          box-shadow: 0 0 0 2px ${ochre.deep}, 0 0 10px ${ochre.glow};
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
        /* AE108 — season row in pin tooltip */
        .aether-pin-tooltip-season {
          font-family: ${theme.font.ui};
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${olive.deep};
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid ${ink.whisper};
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
