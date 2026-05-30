'use client';

/**
 * <TripShareCard> — 1200×630 share preview (AE79).
 *
 * Renders an SVG of the journey suitable for use as an Open Graph
 * image / social card / blog inline. No canvas, no rasterization
 * dependency — pure SVG so it stays crisp at any zoom and the
 * download is a single file. Browsers happily display SVG inline
 * and most social-card validators accept it (the Aether route
 * metadata still references Unsplash photos for OG; this card is
 * an additive, user-triggered export).
 *
 * Composition (mirrors the dashboard's editorial language):
 *   • Top band: terracotta wedge with "Aether · Your journey".
 *   • Title in display-serif (svg <text>).
 *   • Facts row: dates / radius / days.
 *   • Bottom band: TravelSuperApp footnote in mono.
 *
 * The colours are hard-coded to the Warm Italian hex palette so the
 * exported SVG doesn't depend on the theme provider being available
 * (it'll be opened in image viewers, not React trees).
 */
import { useState } from 'react';
import { useTheme } from '@app/aether-core';

/** AE82 — broadened input shape so the share card also accepts a
 *  shared/cloned trip (SharedTripDto has no `status` / `version`).
 *  TripDto callers pass through unchanged; SharedTripDto callers
 *  satisfy the same structural shape minus `status`. */
export interface ShareCardTrip {
  readonly id: string;
  readonly title: string;
  readonly radiusKm: number;
  readonly startsOn: unknown;
  readonly endsOn: unknown;
  /** Optional — omitted for SharedTripDto callers. */
  readonly status?: string;
}

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochre: '#C28A4A',
  ochreGlow: '#E8B777',
  olive: '#6E7B5C',
};

function asIso(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function fmtDate(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  return Math.max(0, Math.round(ms / 86_400_000)) + 1;
}

/** Crude SVG-safe text — escapes the five XML metachars so titles
 *  with `<`, `>`, `&`, `"`, `'` don't break the markup. */
function svgEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function shareSvg(trip: ShareCardTrip): string {
  const title = svgEscape(trip.title);
  const startsOn = asIso(trip.startsOn);
  const endsOn = asIso(trip.endsOn);
  const range =
    startsOn !== null && endsOn !== null
      ? `${fmtDate(trip.startsOn)} → ${fmtDate(trip.endsOn)}`
      : 'Range to be set';
  const days = daysBetween(trip.startsOn, trip.endsOn);
  // Pick a title font size that scales down for longer titles.
  const titleLen = trip.title.length;
  const titleFs = titleLen > 28 ? 72 : titleLen > 20 ? 88 : 110;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- background -->
  <rect width="1200" height="630" fill="${COL.cream}"/>
  <!-- terracotta wedge -->
  <path d="M 0 0 H 1200 V 96 L 1080 138 L 0 96 Z" fill="${COL.terracotta}"/>
  <!-- bottom band -->
  <rect x="0" y="558" width="1200" height="72" fill="${COL.ink}"/>
  <!-- ochre rule -->
  <line x1="80" y1="498" x2="1120" y2="498" stroke="${COL.ochre}" stroke-width="1.5" stroke-opacity="0.55"/>
  <!-- header eyebrow -->
  <text x="80" y="60" fill="${COL.cream}" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" letter-spacing="4">
    AETHER · YOUR JOURNEY
  </text>
  <!-- title -->
  <text x="80" y="280" fill="${COL.ink}" font-family="GT Sectra, Playfair Display, Georgia, serif" font-size="${titleFs}" font-weight="600" letter-spacing="-1.6">
    ${title}
  </text>
  <!-- italic underline -->
  <text x="80" y="350" fill="${COL.inkSoft}" font-family="GT Sectra, Playfair Display, Georgia, serif" font-size="30" font-style="italic">
    Slow travel, sketched by AI.
  </text>
  <!-- facts row -->
  <g font-family="Inter, system-ui, sans-serif">
    <text x="80" y="450" fill="${COL.inkSoft}" font-size="14" font-weight="600" letter-spacing="2">RANGE</text>
    <text x="80" y="478" fill="${COL.ink}" font-size="22" font-weight="600">${svgEscape(range)}</text>

    <text x="480" y="450" fill="${COL.inkSoft}" font-size="14" font-weight="600" letter-spacing="2">RADIUS</text>
    <text x="480" y="478" fill="${COL.ink}" font-size="22" font-weight="600">${trip.radiusKm} km</text>

    <text x="720" y="450" fill="${COL.inkSoft}" font-size="14" font-weight="600" letter-spacing="2">DAYS</text>
    <text x="720" y="478" fill="${COL.ink}" font-size="22" font-weight="600">${days ?? '—'}</text>

    <text x="900" y="450" fill="${COL.inkSoft}" font-size="14" font-weight="600" letter-spacing="2">STATUS</text>
    <text x="900" y="478" fill="${COL.terracottaDeep}" font-size="22" font-weight="600">${svgEscape(trip.status ?? 'shared')}</text>
  </g>
  <!-- footer -->
  <text x="80" y="603" fill="${COL.ochreGlow}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="14" letter-spacing="2">
    TRAVELSUPERAPP · AETHER 2.0
  </text>
  <text x="1120" y="603" fill="${COL.cream}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="14" letter-spacing="2" text-anchor="end" opacity="0.78">
    ${svgEscape(trip.id.slice(0, 8))}
  </text>
  <!-- AetherMark glyph (bottom-right of the cream area) -->
  <g transform="translate(1080, 90) scale(2.2)">
    <circle cx="12" cy="11" r="6.4" fill="none" stroke="${COL.cream}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="4.5" r="1.2" fill="${COL.cream}"/>
    <path d="M 12 17.4 C 13.6 18.6, 15.4 19.0, 16.8 18.4 C 18.0 17.9, 18.4 16.6, 17.4 15.8" fill="none" stroke="${COL.cream}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="11" r="1.05" fill="${COL.cream}"/>
  </g>
</svg>`;
}

export interface TripShareCardProps {
  /** TripDto satisfies ShareCardTrip structurally; SharedTripDto
   *  callers can omit `status`. */
  readonly trip: ShareCardTrip;
}

/** Compact preview + Download button. Mounted from the journey
 *  dashboard near the share band. */
export function TripShareCard({ trip }: TripShareCardProps): React.ReactElement {
  const theme = useTheme();
  const [downloading, setDownloading] = useState<boolean>(false);
  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const olive = theme.palette.olive;

  function download(): void {
    if (downloading) return;
    setDownloading(true);
    try {
      const svg = shareSvg(trip);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = trip.title
        .replace(/[^a-z0-9-_ ]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      a.download = `aether-${slug || 'journey'}-card.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // Render a scaled-down preview using dangerouslySetInnerHTML on a
  // <div>. The SVG sets viewBox so it scales cleanly.
  const svgMarkup = shareSvg(trip);

  return (
    <div
      style={{
        padding: theme.space.loose,
        borderRadius: theme.radius.lg,
        background: surface.soft,
        border: `1px solid ${olive.whisper}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: theme.space.comfy,
          flexWrap: 'wrap',
          marginBottom: theme.space.tight,
        }}
      >
        <p
          style={{
            fontFamily: theme.font.ui,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: olive.deep,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Share card · 1200 × 630 SVG
        </p>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          style={{
            padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
            borderRadius: theme.radius.pill,
            background: accent.base,
            color: surface.base,
            fontFamily: theme.font.ui,
            fontSize: theme.text.small.size,
            fontWeight: 600,
            border: 'none',
            cursor: downloading ? 'wait' : 'pointer',
          }}
        >
          {downloading ? 'Composing…' : 'Download SVG →'}
        </button>
      </div>
      {/* Preview — the SVG markup rendered inline, scaled by the
          container width via the SVG's intrinsic viewBox. */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1200 / 630',
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          border: `1px solid ${ink.whisper}`,
        }}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  );
}
